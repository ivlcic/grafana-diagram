import { buildMetricValueMap, normalizeLabelNewlines, replaceSeriesValuesInContent } from './metricValues';
import { DiagramSeriesModel } from '../config/types';

const createMockModel = (label: string, valueText: string, numeric: number): DiagramSeriesModel => ({
  label,
  isVisible: true,
  seriesIndex: 0,
  timeStep: 1000,
  data: [[1, numeric]],
  info: [
    {
      text: valueText,
      numeric,
      title: 'last',
    },
  ],
  timeField: {} as any,
  valueField: {
    config: {
      custom: {
        valueName: 'last',
      },
    },
  } as any,
});

describe('metricValues', () => {
  describe('buildMetricValueMap', () => {
    it('should map metric names to their formatted display values', () => {
      const models = [createMockModel('cpu', '42%', 42), createMockModel('memory', '1.5 GB', 1.5)];
      const map = buildMetricValueMap(models);

      expect(map.get('cpu')).toBe('42%');
      expect(map.get('memory')).toBe('1.5 GB');
    });

    it('should include composite metrics', () => {
      const models = [createMockModel('cpu-0', '40%', 40), createMockModel('cpu-1', '60%', 60)];
      const composites = [
        {
          name: 'cpu-max',
          members: ['cpu-0', 'cpu-1'],
          valueName: 'last' as const,
          showLowestValue: false,
        },
      ];
      const map = buildMetricValueMap(models, composites);

      expect(map.get('cpu-max')).toBe('60%');
    });
  });

  describe('replaceSeriesValuesInContent', () => {
    it('should replace $__metric placeholders with display values', () => {
      const map = new Map<string, string>([
        ['cpu', '42%'],
        ['memory', '1.5 GB'],
      ]);
      const content = 'graph LR\n    A[$__cpu] --> B[$__memory]';

      expect(replaceSeriesValuesInContent(content, map)).toBe('graph LR\n    A[42%] --> B[1.5 GB]');
    });

    it('should convert newline markers to br tags', () => {
      const map = new Map<string, string>([['cpu', '42%']]);
      const content = 'A[$__cpu usage_n_more]';

      expect(replaceSeriesValuesInContent(content, map)).toBe('A[42% usage<br />more]');
    });

    it('should leave unknown placeholders untouched', () => {
      const map = new Map<string, string>([['cpu', '42%']]);
      const content = 'A[$__cpu] --> B[$__unknown]';

      expect(replaceSeriesValuesInContent(content, map)).toBe('A[42%] --> B[$__unknown]');
    });

    it('should collapse adjacent br tags created from <br />_n_ patterns', () => {
      const map = new Map<string, string>([['cpu', '42%']]);
      const content = 'A[before <br />_n_ after: $__cpu]';

      expect(replaceSeriesValuesInContent(content, map)).toBe('A[before <br /> after: 42%]');
    });
  });

  describe('normalizeLabelNewlines', () => {
    it('should convert raw newlines inside edge labels to br tags', () => {
      const content = 'A -->|"Line1\nLine2"| B';
      expect(normalizeLabelNewlines(content)).toBe('A -->|"Line1<br />Line2"| B');
    });

    it('should convert raw newlines inside node text brackets', () => {
      const content = 'A[Line1\nLine2]';
      expect(normalizeLabelNewlines(content)).toBe('A[Line1<br />Line2]');
    });

    it('should not convert newlines outside labels', () => {
      const content = 'A[Line1]\nB[Line2]\nC --> D';
      expect(normalizeLabelNewlines(content)).toBe('A[Line1]\nB[Line2]\nC --> D');
    });

    it('should handle multi-line edge labels', () => {
      const content = 'SN-e_fail -->|"Opoint 12.6\n\nSTA: 0\nAdmin: 1.05"| SMSH';
      expect(normalizeLabelNewlines(content)).toBe(
        'SN-e_fail -->|"Opoint 12.6<br /><br />STA: 0<br />Admin: 1.05"| SMSH'
      );
    });
  });
});
