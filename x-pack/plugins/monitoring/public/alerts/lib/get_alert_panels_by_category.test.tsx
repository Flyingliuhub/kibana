/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import {
  RULE_CPU_USAGE,
  RULE_LOGSTASH_VERSION_MISMATCH,
  RULE_THREAD_POOL_WRITE_REJECTIONS,
} from '../../../common/constants';
import { AlertSeverity } from '../../../common/enums';
import { getAlertPanelsByCategory } from './get_alert_panels_by_category';
import {
  RULE_LICENSE_EXPIRATION,
  RULE_NODES_CHANGED,
  RULE_DISK_USAGE,
  RULE_MEMORY_USAGE,
} from '../../../common/constants';
import { RuleExecutionStatusValues } from '../../../../alerting/common';
import { AlertState } from '../../../common/types/alerts';

jest.mock('../../legacy_shims', () => ({
  Legacy: {
    shims: {
      uiSettings: {
        get: () => '',
      },
    },
  },
}));

jest.mock('../../../common/formatting', () => ({
  getDateFromNow: (timestamp: number) => `triggered:${timestamp}`,
  getCalendar: (timestamp: number) => `triggered:${timestamp}`,
}));

const mockAlert = {
  id: '',
  enabled: true,
  tags: [],
  consumer: '',
  schedule: { interval: '1m' },
  actions: [],
  params: {},
  createdBy: null,
  updatedBy: null,
  createdAt: new Date('2020-12-08'),
  updatedAt: new Date('2020-12-08'),
  apiKey: null,
  apiKeyOwner: null,
  throttle: null,
  muteAll: false,
  mutedInstanceIds: [],
  executionStatus: {
    status: RuleExecutionStatusValues[0],
    lastExecutionDate: new Date('2020-12-08'),
  },
  notifyWhen: null,
};

describe('getAlertPanelsByCategory', () => {
  const ui = {
    isFiring: false,
    severity: AlertSeverity.Danger,
    message: { text: '' },
    resolvedMS: 0,
    lastCheckedMS: 0,
    triggeredMS: 0,
  };

  const cluster = { clusterUuid: '1', clusterName: 'one' };

  function getAlert(type: string, firingCount: number) {
    const states = [];

    for (let fi = 0; fi < firingCount; fi++) {
      states.push({
        firing: true,
        meta: {},
        state: {
          cluster,
          ui: {
            ...ui,
            triggeredMS: fi,
          },
          nodeId: `es${fi}`,
          nodeName: `es_name_${fi}`,
        },
      });
    }

    return {
      states,
      sanitizedRule: {
        alertTypeId: type,
        name: `${type}_label`,
        ...mockAlert,
      },
    };
  }

  const stateFilter = (state: AlertState) => true;
  const panelTitle = 'Alerts';

  describe('non setup mode', () => {
    it('should properly group for alerts in each category', () => {
      const alerts = [
        getAlert(RULE_NODES_CHANGED, 2),
        getAlert(RULE_DISK_USAGE, 1),
        getAlert(RULE_LICENSE_EXPIRATION, 2),
      ];
      const result = getAlertPanelsByCategory(panelTitle, false, alerts, stateFilter);
      expect(result).toMatchSnapshot();
    });

    it('should properly group for alerts in a single category', () => {
      const alerts = [getAlert(RULE_MEMORY_USAGE, 2)];
      const result = getAlertPanelsByCategory(panelTitle, false, alerts, stateFilter);
      expect(result).toMatchSnapshot();
    });

    it('should not show any alert if none are firing', () => {
      const alerts = [
        getAlert(RULE_LOGSTASH_VERSION_MISMATCH, 0),
        getAlert(RULE_CPU_USAGE, 0),
        getAlert(RULE_THREAD_POOL_WRITE_REJECTIONS, 0),
      ];
      const result = getAlertPanelsByCategory(panelTitle, false, alerts, stateFilter);
      expect(result).toMatchSnapshot();
    });

    it('should allow for state filtering', () => {
      const alerts = [getAlert(RULE_CPU_USAGE, 2)];
      const customStateFilter = (state: AlertState) => state.nodeName === 'es_name_0';
      const result = getAlertPanelsByCategory(panelTitle, false, alerts, customStateFilter);
      expect(result).toMatchSnapshot();
    });
  });

  describe('setup mode', () => {
    it('should properly group for alerts in each category', () => {
      const alerts = [
        getAlert(RULE_NODES_CHANGED, 2),
        getAlert(RULE_DISK_USAGE, 1),
        getAlert(RULE_LICENSE_EXPIRATION, 2),
      ];
      const result = getAlertPanelsByCategory(panelTitle, true, alerts, stateFilter);
      expect(result).toMatchSnapshot();
    });

    it('should properly group for alerts in a single category', () => {
      const alerts = [getAlert(RULE_MEMORY_USAGE, 2)];
      const result = getAlertPanelsByCategory(panelTitle, true, alerts, stateFilter);
      expect(result).toMatchSnapshot();
    });

    it('should still show alerts if none are firing', () => {
      const alerts = [
        getAlert(RULE_LOGSTASH_VERSION_MISMATCH, 0),
        getAlert(RULE_CPU_USAGE, 0),
        getAlert(RULE_THREAD_POOL_WRITE_REJECTIONS, 0),
      ];
      const result = getAlertPanelsByCategory(panelTitle, true, alerts, stateFilter);
      expect(result).toMatchSnapshot();
    });
  });
});
