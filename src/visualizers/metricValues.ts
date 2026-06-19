import { DisplayValue, formattedValueToString } from '@grafana/data';
import { CompositeMetric, DiagramSeriesModel } from '../config/types';

export type MetricIndicator = DisplayValue & {
  metricName: string;
  valueName: string;
  isComposite?: boolean;
  originalName?: string;
};

export const reduceModels = (models: DiagramSeriesModel[]): MetricIndicator[] => {
  return models
    .filter((m) => m.valueField.config.custom)
    .flatMap((m) => {
      const dv = m.info?.find((dv) => dv.title === m.valueField.config.custom.valueName);
      if (!dv) {
        return null;
      }
      return {
        ...dv,
        metricName: m.label,
        valueName: dv.title,
      };
    })
    .filter((m) => m != null) as any;
};

export const reduceComposites = (indicators: MetricIndicator[], composites: CompositeMetric[]): MetricIndicator[] => {
  return composites
    .map((c) => {
      const candidates = c.members.flatMap((m) => {
        return indicators.filter((i) => i.metricName === m);
      });
      if (candidates.length > 0) {
        const compositeIndicator = candidates.reduce((prev, current) => {
          const previousValue = isNaN(prev.numeric) ? 0 : prev.numeric;
          const currentValue = isNaN(current.numeric) ? 0 : current.numeric;
          const currentIsLower = currentValue < previousValue;
          if (c.showLowestValue) {
            return currentIsLower ? current : prev;
          } else {
            return currentIsLower ? prev : current;
          }
        });
        compositeIndicator.isComposite = true;
        compositeIndicator.originalName = compositeIndicator.metricName;
        compositeIndicator.metricName = c.name;
        return compositeIndicator;
      } else {
        return null;
      }
    })
    .filter((c) => c != null) as any;
};

/**
 * Build a map of metric/composite names to their formatted display values.
 * This powers the `$__metricName` custom variable replacement in diagram text.
 */
export const buildMetricValueMap = (
  models: DiagramSeriesModel[],
  composites: CompositeMetric[] = []
): Map<string, string> => {
  const indicators = reduceModels(models);
  const allIndicators = [...indicators, ...reduceComposites(indicators, composites)];
  const map = new Map<string, string>();
  allIndicators.forEach((indicator) => {
    map.set(indicator.metricName, formattedValueToString(indicator));
  });
  return map;
};

/**
 * Replace `$__metricName` placeholders with the corresponding formatted values.
 * Also converts the custom newline markers `_n_`, `\n` and `_br_` into `<br />`.
 */
export const replaceSeriesValuesInContent = (content: string, valueMap: Map<string, string>): string => {
  const regex = /(\$__[\w\-\.]+)/gm;
  const match = content.match(regex);
  if (match) {
    match.forEach((varMetricName: string) => {
      const metricName = varMetricName.substring(3); // remove $__ prefix
      const value = valueMap.get(metricName);
      if (value !== undefined) {
        content = content.replace(varMetricName, value);
      }
    });
    content = content.replace(/_n_/gm, '<br />');
    content = content.replace(/\\n/gm, '<br />');
    content = content.replace(/_br_/gm, '<br />');
    // Avoid double line breaks when the source already had <br /> next to _n_/\n/_br_
    content = content.replace(/<br\s*\/?>\s*<br\s*\/>/gi, '<br />');
  }
  return content;
};

/**
 * Mermaid 10.x no longer reliably renders raw newline characters inside
 * flowchart labels. Convert real newlines inside edge labels (`|"..."|`) and
 * node text (`[...]`, `(...)`, `{...}`) to `<br />` so Mermaid parses and
 * renders them correctly with `htmlLabels: true`.
 */
export const normalizeLabelNewlines = (content: string): string => {
  // Edge labels: |"..."| or |...|
  content = content.replace(/\|[^|]*\|/gs, (match) => match.replace(/\n/g, '<br />'));
  // Node / class / stadium / circle / subroutine / cylinder / asymetric shapes
  content = content.replace(/\[[^\[\]]*\]/gs, (match) => match.replace(/\n/g, '<br />'));
  content = content.replace(/\([^()]*\)/gs, (match) => match.replace(/\n/g, '<br />'));
  content = content.replace(/\{[^{}]*\}/gs, (match) => match.replace(/\n/g, '<br />'));
  return content;
};
