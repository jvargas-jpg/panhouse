import {beforeEach,describe,expect,it,vi} from 'vitest';
vi.unmock('../server/queue/projectWorkspaces.queue.js');
const mocks=vi.hoisted(()=>({getJob:vi.fn(),add:vi.fn()}));
vi.mock('../server/queue/connection.js',()=>({redisConnection:{}}));
vi.mock('bullmq',()=>({Queue:class {getJob=mocks.getJob;add=mocks.add;}}));
import {enqueueProjectWorkspace,workspaceJobId,WORKSPACE_JOB} from '../server/queue/projectWorkspaces.queue.js';
describe('BullMQ workspace business key and retained-job recovery',()=>{
  beforeEach(()=>vi.resetAllMocks());
  it('payload mínimo y business key estable compatible con BullMQ',async()=>{
    await enqueueProjectWorkspace('project-123');
    expect(workspaceJobId('project-123')).toBe('project-drive-workspace-project-123');
    expect(mocks.add).toHaveBeenCalledWith(WORKSPACE_JOB,{projectId:'project-123'},expect.objectContaining({jobId:workspaceJobId('project-123'),attempts:4}));
  });
  it.each(['active','waiting','delayed'])('job %s no se duplica',async state=>{
    const retry=vi.fn();mocks.getJob.mockResolvedValue({getState:async()=>state,retry});
    await enqueueProjectWorkspace('p');expect(mocks.add).not.toHaveBeenCalled();expect(retry).not.toHaveBeenCalled();
  });
  it.each(['failed','completed'])('recovery de job %s retenido no queda atascado por deduplicación',async state=>{
    const retry=vi.fn();mocks.getJob.mockResolvedValue({getState:async()=>state,retry});
    await enqueueProjectWorkspace('p');expect(retry).toHaveBeenCalledWith(state);expect(mocks.add).not.toHaveBeenCalled();
  });
});
