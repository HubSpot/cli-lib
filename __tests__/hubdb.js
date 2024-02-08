const fs = require('fs-extra');
const { downloadHubDbTable, createHubDbTable } = require('../hubdb');
const hubdb = require('../api/hubdb');
const { getCwd } = require('../path');
const hubdbJson = require('./fixtures/hubdb/hubdbTableData');
const hubdbFetchRowResponse = require('./fixtures/hubdb/hubdbFetchRowsResponse.json');
const hubdbFetchRowsWithPagingResponse = require('./fixtures/hubdb/hubdbFetchRowsWithPaging.json');
const hubdbFetchTableResponse = require('./fixtures/hubdb/hubdbFetchTableResponse.json');
const hubdbCreateTableResponse = require('./fixtures/hubdb/hubdbCreateTableResponse.json');
const hubdbCreateRowsResponse = require('./fixtures/hubdb/hubdbCreateRowsResponse.json');
const hubdbPublishTableResponse = require('./fixtures/hubdb/hubdbPublishTableResponse.json');

jest.mock('../path');
jest.mock('../api/hubdb');

describe('cli-lib/hubdb', () => {
  describe('downloadHubDbTable', () => {
    const accountId = 123;
    const tableId = 456;
    const destPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    getCwd.mockReturnValue(projectCwd);
    hubdb.fetchRows.mockReturnValue(hubdbFetchRowResponse);
    hubdb.fetchTable.mockReturnValue(hubdbFetchTableResponse);

    it('fetches all results', async () => {
      const { filePath } = await downloadHubDbTable(
        accountId,
        tableId,
        destPath
      );
      const fileOutput = JSON.parse(fs.outputFile.mock.results[0].value);

      expect(fileOutput.rows.length).toBe(3);
      expect(fileOutput.rows[1].name).toBe('My Better Event');
      expect(fileOutput.rows[0].values['second_col']).toBe('b');
      expect(fileOutput.name).toBe('cool-table-name');
      expect(filePath).toEqual(`${projectCwd}/${destPath}`);
    });
  });

  describe('paging', () => {
    it('fetches all results', async () => {
      const accountId = 123;
      const tableId = 456;
      const destPath = 'tmp.json';
      const projectCwd = '/home/tom/projects';

      getCwd.mockReturnValue(projectCwd);

      hubdb.fetchRows.mockReturnValue(hubdbFetchRowResponse);
      hubdb.fetchTable.mockReturnValue(hubdbFetchTableResponse);

      hubdb.fetchRows.mockReturnValueOnce(hubdbFetchRowsWithPagingResponse);

      await downloadHubDbTable(accountId, tableId, destPath);
      const fileOutput = JSON.parse(fs.outputFile.mock.results[1].value);
      expect(fileOutput.rows.length).toEqual(6);
      expect(fileOutput.rows[0].name).toMatchInlineSnapshot(`"Paging 1"`);
      expect(fileOutput.rows[5].name).toMatchInlineSnapshot(`"My Best Event"`);
    });
  });

  describe('createHubDbTable', () => {
    const accountId = 123;
    const srcPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    fs.statSync.mockReturnValue({ isFile: () => true });
    fs.readJsonSync.mockReturnValue(hubdbJson);

    hubdb.createTable.mockReturnValue(hubdbCreateTableResponse);
    hubdb.createRows.mockReturnValue(hubdbCreateRowsResponse);
    hubdb.publishTable.mockReturnValue(hubdbPublishTableResponse);

    it('creates a table', async () => {
      const table = await createHubDbTable(
        accountId,
        `${projectCwd}/${srcPath}`
      );

      expect(table.rowCount).toEqual(3);
      expect(table.tableId).toEqual(2639452);
      expect(hubdb.publishTable).toBeCalled();
    });
  });
});
