import test from 'node:test';import assert from 'node:assert/strict';
import {formatSavedAt,timestampDescription} from '../src/time.mjs';
import {readPreference,SIDEBAR_KEY,FOCUS_KEY} from '../src/workspace.mjs';
import {validateArchive} from '../src/core.mjs';
test('timestamps show seconds without changing ISO originals',()=>{const s='2026-11-01T09:18:07.140Z';assert.match(formatSavedAt(s),/^\d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}:\d{2}$/);assert.match(timestampDescription(s),/09:18:07.140Z/);});
test('preferences are UI-only and safe on storage errors',()=>{assert.notEqual(SIDEBAR_KEY,FOCUS_KEY);assert.equal(readPreference({getItem:()=>null},SIDEBAR_KEY,true),true);assert.equal(readPreference({getItem:()=>{throw Error('blocked')}},FOCUS_KEY),false);});
test('old archive remains valid with original raw',()=>{const a={format:'afkary-backup',schemaVersion:1,entries:[{id:'one',raw:'  فكرة\n',createdAt:'2026-11-01T09:18:07.140Z',checksum:'a'.repeat(64)}],annotations:[]};assert.equal(validateArchive(a),a);assert.equal(a.entries[0].raw,'  فكرة\n');});
