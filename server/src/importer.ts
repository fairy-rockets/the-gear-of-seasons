import * as fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

import * as protocol from 'lib/protocol';

import Shelf from './shelf/Shelf';
import Repo from './repo/Repo';
import {formatMomentTime, Moment} from "./shelf/Moment";
import dayjs from "dayjs";

async function walk(dirPath: string, pat: RegExp, inverted: boolean, fn: (filepath: string) => Promise<any>) {
  const entries = await fs.opendir(dirPath);
  for await (const entry of entries) {
    if (entry.isDirectory()) {
      await walk(path.join(dirPath, entry.name), pat, inverted, fn);
    }
    if (entry.isFile()) {
      if(!inverted) {
        if (pat.test(entry.name)) {
          await fn(path.join(dirPath, entry.name));
        }
      } else {
        if (!pat.test(entry.name)) {
          await fn(path.join(dirPath, entry.name));
        }
      }
    }
  }
}

async function main() {
  const repo = new Repo();
  const shelf = new Shelf(repo);
  await walk(
    path.join(__dirname, '..', '..', '_shelf', 'moment'),
    /^.*?\.yml$/,
    false,
    async(filepath) => {
      try {
        const content = await fs.readFile(filepath, {encoding: 'utf-8'});
        const raw: any = yaml.load(content);
        const date = dayjs(raw.date as Date).subtract(9, 'hour');
        const moment: protocol.Moment.Save.Request = {
          title: raw.title,
          date: formatMomentTime(date),
          originalDate: null,
          author: raw.author,
          text: raw.text,
        };
        await shelf.saveMoment(moment);
      } catch (e) {
        console.error("Failed to register", filepath);
      }
    }
  );
  console.log("All done, have fun!");
}

main()
  .then(() => {})
  .catch((err) => {
    console.error(err);
    throw err;
  });
