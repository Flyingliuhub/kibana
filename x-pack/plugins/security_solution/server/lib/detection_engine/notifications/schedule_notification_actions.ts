/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { mapKeys, snakeCase } from 'lodash/fp';
import { Alert } from '../../../../../alerting/server';
import { expandDottedObject } from '../../../../common/utils/expand_dotted';
import { RuleParams } from '../schemas/rule_schemas';
import aadFieldConversion from '../routes/index/signal_aad_mapping.json';
import { isDetectionAlert } from '../signals/utils';
import { DetectionAlert } from '../../../../common/detection_engine/schemas/alerts';

export type NotificationRuleTypeParams = RuleParams & {
  id: string;
  name: string;
};

const convertToLegacyAlert = (alert: DetectionAlert) =>
  Object.entries(aadFieldConversion).reduce((acc, [legacyField, aadField]) => {
    const val = alert[aadField];
    if (val != null) {
      return {
        ...acc,
        [legacyField]: val,
      };
    }
    return acc;
  }, {});

/*
 * Formats alerts before sending to `scheduleActions`. We augment the context with
 * the equivalent "legacy" alert context so that pre-8.0 actions will continue to work.
 */
const formatAlertsForNotificationActions = (alerts: unknown[]): unknown[] => {
  return alerts.map((alert) =>
    isDetectionAlert(alert)
      ? {
          ...expandDottedObject(convertToLegacyAlert(alert)),
          ...expandDottedObject(alert),
        }
      : alert
  );
};

interface ScheduleNotificationActions {
  alertInstance: Alert;
  signalsCount: number;
  resultsLink: string;
  ruleParams: NotificationRuleTypeParams;
  signals: unknown[];
}

export const scheduleNotificationActions = ({
  alertInstance,
  signalsCount,
  resultsLink = '',
  ruleParams,
  signals,
}: ScheduleNotificationActions): Alert =>
  alertInstance
    .replaceState({
      signals_count: signalsCount,
    })
    .scheduleActions('default', {
      results_link: resultsLink,
      rule: mapKeys(snakeCase, ruleParams),
      alerts: formatAlertsForNotificationActions(signals),
    });
