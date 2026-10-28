import type { BackgroundTaskSay } from '../../../src/shared/background-task-copy'
import { translate } from '../i18n/mobile-i18n'

export const sayMobileBackgroundTask: BackgroundTaskSay = (id, values) => {
  const count = Number(values?.value0 ?? 1)
  const copy = {
    monitoring: () => translate('session.backgroundTask.monitoring', 'Monitoring background tasks'),
    stop: () => translate('session.backgroundTask.stop', 'Stop'),
    stopTask: () => translate('session.backgroundTask.stopTask', 'Stop {{value0}}', values),
    stopAll: () => translate('session.backgroundTask.stopAll', 'Stop background tasks'),
    agent: () => translate('session.backgroundTask.agent', 'Background agent'),
    workflow: () => translate('session.backgroundTask.workflow', 'Background workflow'),
    command: () => translate('session.backgroundTask.command', 'Background command'),
    monitor: () => translate('session.backgroundTask.monitor', 'Background monitor'),
    task: () => translate('session.backgroundTask.task', 'Background task'),
    detailsUnavailable: () =>
      translate(
        'session.backgroundTask.detailsUnavailable',
        'Task details are unavailable for this session.'
      ),
    countAgentsOne: () =>
      translate('session.backgroundTask.countAgents_one', '{{count}} agent', { count: 1 }),
    countAgentsMany: () =>
      count === 1
        ? translate('session.backgroundTask.countAgents_one', '{{count}} agent', { count })
        : translate('session.backgroundTask.countAgents_other', '{{count}} agents', { count }),
    countShellOne: () =>
      translate('session.backgroundTask.countShell_one', '{{count}} shell', { count: 1 }),
    countShellMany: () =>
      count === 1
        ? translate('session.backgroundTask.countShell_one', '{{count}} shell', { count })
        : translate('session.backgroundTask.countShell_other', '{{count}} shells', { count }),
    countShellCommandOne: () =>
      translate('session.backgroundTask.countShellCommandOne', '1 shell command'),
    countMonitorsOne: () =>
      translate('session.backgroundTask.countMonitors_one', '{{count}} monitor', { count: 1 }),
    countMonitorsMany: () =>
      count === 1
        ? translate('session.backgroundTask.countMonitors_one', '{{count}} monitor', { count })
        : translate('session.backgroundTask.countMonitors_other', '{{count}} monitors', { count }),
    countWorkflowsOne: () =>
      translate('session.backgroundTask.countWorkflows_one', '{{count}} workflow', { count: 1 }),
    countWorkflowsMany: () =>
      count === 1
        ? translate('session.backgroundTask.countWorkflows_one', '{{count}} workflow', { count })
        : translate('session.backgroundTask.countWorkflows_other', '{{count}} workflows', {
            count
          }),
    countTasksOne: () =>
      translate('session.backgroundTask.countTasks_one', '{{count}} task', { count: 1 }),
    countTasksMany: () =>
      count === 1
        ? translate('session.backgroundTask.countTasks_one', '{{count}} task', { count })
        : translate('session.backgroundTask.countTasks_other', '{{count}} tasks', { count }),
    headerTotal: () =>
      translate('session.backgroundTask.headerTotal', '{{value0}} background tasks', values),
    stateWorking: () => translate('session.backgroundTask.stateWorking', 'working'),
    stateWorkingCount: () =>
      translate('session.backgroundTask.stateWorkingCount', '{{value0}} working', values),
    stateMonitoring: () => translate('session.backgroundTask.stateMonitoring', 'monitoring'),
    stateMonitoringCount: () =>
      translate('session.backgroundTask.stateMonitoringCount', '{{value0}} monitoring', values),
    stateWaiting: () => translate('session.backgroundTask.stateWaiting', 'waiting'),
    stateWaitingCount: () =>
      translate('session.backgroundTask.stateWaitingCount', '{{value0}} waiting', values),
    stateBlocked: () => translate('session.backgroundTask.stateBlocked', 'blocked'),
    stateBlockedCount: () =>
      translate('session.backgroundTask.stateBlockedCount', '{{value0}} blocked', values),
    stateDone: () => translate('session.backgroundTask.stateDone', 'done'),
    stateDoneCount: () =>
      translate('session.backgroundTask.stateDoneCount', '{{value0}} done', values),
    stateIdle: () => translate('session.backgroundTask.stateIdle', 'stopped'),
    stateIdleCount: () =>
      translate('session.backgroundTask.stateIdleCount', '{{value0}} stopped', values),
    stateUnverifiable: () =>
      translate('session.backgroundTask.stateUnverifiable', 'status unavailable'),
    stateUnverifiableCount: () =>
      translate(
        'session.backgroundTask.stateUnverifiableCount',
        '{{value0}} with status unavailable',
        values
      ),
    reasonWaiting: () => translate('session.backgroundTask.reasonWaiting', 'needs approval'),
    reasonBlocked: () => translate('session.backgroundTask.reasonBlocked', 'failed'),
    groupAgents: () => translate('session.backgroundTask.groupAgents', 'Agents'),
    groupShell: () => translate('session.backgroundTask.groupShell', 'Shell'),
    groupMonitors: () => translate('session.backgroundTask.groupMonitors', 'Monitors'),
    groupWorkflows: () => translate('session.backgroundTask.groupWorkflows', 'Workflows'),
    groupTasks: () => translate('session.backgroundTask.groupTasks', 'Tasks')
  }
  return copy[id]()
}
