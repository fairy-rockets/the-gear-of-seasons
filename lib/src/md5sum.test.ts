// https://jestjs.io/docs/api
import {describe, expect, it } from '@jest/globals';
import * as path from 'path';
import md5sum from './md5sum';

describe("MD5SUM", () => {
  it("test empty", async () => {
    const hash = await md5sum(path.join(__dirname, 'md5sum.test.empty.blob'));
    expect(hash).toEqual('d41d8cd98f00b204e9800998ecf8427e');
  });
});
