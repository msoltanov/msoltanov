import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HtmlValidate } from 'html-validate';

const url = 'http://127.0.0.1:4173/?motion=play';
const response = await fetch(url);
assert.ok(response.ok, 'Start the local preview before its HTML check.');
const config = JSON.parse(
  await readFile(new URL('../.htmlvalidate.json', import.meta.url), 'utf8'),
);
const validator = new HtmlValidate(config);
const report = await validator.validateString(await response.text());
if (!report.valid) {
  for (const result of report.results) {
    for (const message of result.messages) {
      process.stderr.write(
        `${message.line}:${message.column} ${message.ruleId}: ${message.message}\n`,
      );
    }
  }
  process.exitCode = 1;
} else {
  process.stdout.write(
    'Local preview HTML passes document and accessibility rules.\n',
  );
}
