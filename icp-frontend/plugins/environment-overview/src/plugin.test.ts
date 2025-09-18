import { environmentOverviewPlugin } from './plugin';

describe('environment-overview', () => {
  it('should export plugin', () => {
    expect(environmentOverviewPlugin).toBeDefined();
  });
});
