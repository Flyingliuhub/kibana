/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { MemoryUsageRule } from './memory_usage_rule';
import { RULE_MEMORY_USAGE } from '../../common/constants';
import { fetchMemoryUsageNodeStats } from '../lib/alerts/fetch_memory_usage_node_stats';
import { fetchClusters } from '../lib/alerts/fetch_clusters';
import { elasticsearchServiceMock } from 'src/core/server/mocks';

const RealDate = Date;

jest.mock('../lib/alerts/fetch_memory_usage_node_stats', () => ({
  fetchMemoryUsageNodeStats: jest.fn(),
}));
jest.mock('../lib/alerts/fetch_clusters', () => ({
  fetchClusters: jest.fn(),
}));
jest.mock('../static_globals', () => ({
  Globals: {
    app: {
      getLogger: () => ({ debug: jest.fn() }),
      url: 'http://localhost:5601',
      config: {
        ui: {
          ccs: { enabled: true },
          container: { elasticsearch: { enabled: false } },
        },
      },
    },
  },
}));

describe('MemoryUsageRule', () => {
  it('should have defaults', () => {
    const rule = new MemoryUsageRule();
    expect(rule.ruleOptions.id).toBe(RULE_MEMORY_USAGE);
    expect(rule.ruleOptions.name).toBe('Memory Usage (JVM)');
    expect(rule.ruleOptions.throttle).toBe('1d');
    expect(rule.ruleOptions.defaultParams).toStrictEqual({ threshold: 85, duration: '5m' });
    expect(rule.ruleOptions.actionVariables).toStrictEqual([
      { name: 'node', description: 'The node reporting high memory usage.' },
      {
        name: 'internalShortMessage',
        description: 'The short internal message generated by Elastic.',
      },
      {
        name: 'internalFullMessage',
        description: 'The full internal message generated by Elastic.',
      },
      { name: 'state', description: 'The current state of the alert.' },
      { name: 'clusterName', description: 'The cluster to which the node(s) belongs.' },
      { name: 'action', description: 'The recommended action for this alert.' },
      {
        name: 'actionPlain',
        description: 'The recommended action for this alert, without any markdown.',
      },
    ]);
  });

  describe('execute', () => {
    function FakeDate() {}
    FakeDate.prototype.valueOf = () => 1;

    const clusterUuid = 'abc123';
    const clusterName = 'testCluster';
    const nodeId = 'myNodeId';
    const nodeName = 'myNodeName';
    const memoryUsage = 91;
    const stat = {
      clusterUuid,
      nodeId,
      nodeName,
      memoryUsage,
    };

    const replaceState = jest.fn();
    const scheduleActions = jest.fn();
    const getState = jest.fn();
    const executorOptions = {
      services: {
        scopedClusterClient: elasticsearchServiceMock.createScopedClusterClient(),
        alertFactory: {
          create: jest.fn().mockImplementation(() => {
            return {
              replaceState,
              scheduleActions,
              getState,
            };
          }),
        },
      },
      state: {},
    };

    beforeEach(() => {
      // @ts-ignore
      Date = FakeDate;
      (fetchMemoryUsageNodeStats as jest.Mock).mockImplementation(() => {
        return [stat];
      });
      (fetchClusters as jest.Mock).mockImplementation(() => {
        return [{ clusterUuid, clusterName }];
      });
    });

    afterEach(() => {
      Date = RealDate;
      replaceState.mockReset();
      scheduleActions.mockReset();
      getState.mockReset();
    });

    it('should fire actions', async () => {
      const rule = new MemoryUsageRule();
      const type = rule.getRuleType();
      await type.executor({
        ...executorOptions,
        params: rule.ruleOptions.defaultParams,
      } as any);
      const count = 1;
      expect(replaceState).toHaveBeenCalledWith({
        alertStates: [
          {
            ccs: undefined,
            cluster: { clusterUuid, clusterName },
            memoryUsage,
            itemLabel: undefined,
            meta: {
              clusterUuid,
              memoryUsage,
              nodeId,
              nodeName,
            },
            nodeId,
            nodeName,
            ui: {
              isFiring: true,
              message: {
                text: `Node #start_link${nodeName}#end_link is reporting JVM memory usage of ${memoryUsage}% at #absolute`,
                nextSteps: [
                  {
                    text: '#start_linkTune thread pools#end_link',
                    tokens: [
                      {
                        startToken: '#start_link',
                        endToken: '#end_link',
                        type: 'docLink',
                        partialUrl:
                          '{elasticWebsiteUrl}guide/en/elasticsearch/reference/{docLinkVersion}/modules-threadpool.html',
                      },
                    ],
                  },
                  {
                    text: '#start_linkManaging ES Heap#end_link',
                    tokens: [
                      {
                        startToken: '#start_link',
                        endToken: '#end_link',
                        type: 'docLink',
                        partialUrl: '{elasticWebsiteUrl}blog/a-heap-of-trouble',
                      },
                    ],
                  },
                  {
                    text: '#start_linkIdentify large indices/shards#end_link',
                    tokens: [
                      {
                        startToken: '#start_link',
                        endToken: '#end_link',
                        type: 'link',
                        url: 'elasticsearch/indices',
                      },
                    ],
                  },
                  {
                    text: '#start_linkAdd more data nodes#end_link',
                    tokens: [
                      {
                        startToken: '#start_link',
                        endToken: '#end_link',
                        type: 'docLink',
                        partialUrl:
                          '{elasticWebsiteUrl}guide/en/elasticsearch/reference/{docLinkVersion}/add-elasticsearch-nodes.html',
                      },
                    ],
                  },
                  {
                    text: '#start_linkResize your deployment (ECE)#end_link',
                    tokens: [
                      {
                        startToken: '#start_link',
                        endToken: '#end_link',
                        type: 'docLink',
                        partialUrl:
                          '{elasticWebsiteUrl}guide/en/cloud-enterprise/current/ece-resize-deployment.html',
                      },
                    ],
                  },
                ],
                tokens: [
                  {
                    startToken: '#absolute',
                    type: 'time',
                    isAbsolute: true,
                    isRelative: false,
                    timestamp: 1,
                  },
                  {
                    startToken: '#start_link',
                    endToken: '#end_link',
                    type: 'link',
                    url: 'elasticsearch/nodes/myNodeId',
                  },
                ],
              },
              severity: 'danger',
              triggeredMS: 1,
              lastCheckedMS: 0,
            },
          },
        ],
      });
      expect(scheduleActions).toHaveBeenCalledWith('default', {
        internalFullMessage: `Memory usage alert is firing for node ${nodeName} in cluster: ${clusterName}. [View node](http://localhost:5601/app/monitoring#/elasticsearch/nodes/${nodeId}?_g=(cluster_uuid:${clusterUuid}))`,
        internalShortMessage: `Memory usage alert is firing for node ${nodeName} in cluster: ${clusterName}. Verify memory usage level of node.`,
        action: `[View node](http://localhost:5601/app/monitoring#/elasticsearch/nodes/${nodeId}?_g=(cluster_uuid:${clusterUuid}))`,
        actionPlain: 'Verify memory usage level of node.',
        clusterName,
        count,
        nodes: `${nodeName}:${memoryUsage}.00`,
        node: `${nodeName}:${memoryUsage}.00`,
        state: 'firing',
      });
    });

    it('should not fire actions if under threshold', async () => {
      (fetchMemoryUsageNodeStats as jest.Mock).mockImplementation(() => {
        return [
          {
            ...stat,
            memoryUsage: 1,
          },
        ];
      });
      const rule = new MemoryUsageRule();
      const type = rule.getRuleType();
      await type.executor({
        ...executorOptions,
        params: rule.ruleOptions.defaultParams,
      } as any);
      expect(replaceState).toHaveBeenCalledWith({
        alertStates: [],
      });
      expect(scheduleActions).not.toHaveBeenCalled();
    });

    it('should handle ccs', async () => {
      const ccs = 'testCluster';
      (fetchMemoryUsageNodeStats as jest.Mock).mockImplementation(() => {
        return [
          {
            ...stat,
            ccs,
          },
        ];
      });
      const rule = new MemoryUsageRule();
      const type = rule.getRuleType();
      await type.executor({
        ...executorOptions,
        params: rule.ruleOptions.defaultParams,
      } as any);
      const count = 1;
      expect(scheduleActions).toHaveBeenCalledWith('default', {
        internalFullMessage: `Memory usage alert is firing for node ${nodeName} in cluster: ${clusterName}. [View node](http://localhost:5601/app/monitoring#/elasticsearch/nodes/${nodeId}?_g=(cluster_uuid:${clusterUuid},ccs:${ccs}))`,
        internalShortMessage: `Memory usage alert is firing for node ${nodeName} in cluster: ${clusterName}. Verify memory usage level of node.`,
        action: `[View node](http://localhost:5601/app/monitoring#/elasticsearch/nodes/${nodeId}?_g=(cluster_uuid:${clusterUuid},ccs:testCluster))`,
        actionPlain: 'Verify memory usage level of node.',
        clusterName,
        count,
        nodes: `${nodeName}:${memoryUsage}.00`,
        node: `${nodeName}:${memoryUsage}.00`,
        state: 'firing',
      });
    });
  });
});
