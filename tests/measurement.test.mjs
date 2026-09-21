import test from 'node:test';
import assert from 'node:assert/strict';
import { distanceMm, hasCalibratedSpacing } from '../src/measurement.js';

test('world-space length is exact for axis-aligned mm coordinates',()=>{
  assert.equal(distanceMm([0,0,0],[30,0,0]),30);
  assert.equal(distanceMm([10,20,30],[10,20,55]),25);
});

test('world-space length follows Euclidean 3D distance',()=>{
  assert.equal(distanceMm([0,0,0],[3,4,12]),13);
  assert.ok(Math.abs(distanceMm([1.25,-2,8.5],[4.25,2,20.5])-13)<1e-12);
});

test('invalid points do not produce a fake measurement',()=>{
  assert.ok(Number.isNaN(distanceMm([0,0],[1,2,3])));
  assert.ok(Number.isNaN(distanceMm([0,0,0],[1,2,NaN])));
});

test('calibrated spacing requires three positive finite dimensions',()=>{
  assert.equal(hasCalibratedSpacing([0.7,0.7,1.25]),true);
  assert.equal(hasCalibratedSpacing([0.7,0,1.25]),false);
  assert.equal(hasCalibratedSpacing([0.7,1.25]),false);
});
