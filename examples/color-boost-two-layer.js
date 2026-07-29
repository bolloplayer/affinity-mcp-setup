'use strict';
// color-boost-two-layer.js
//
// The demo script: two independently adjustable Selective Colour layers.
//
//   Boost — saturates the six chromatic ranges using classic CMY complement
//           logic. Per range it removes the contaminating ink and adds the
//           primary inks: Reds are Magenta + Yellow and muddied by Cyan, so
//           the Reds range gets −Cyan +Magenta +Yellow.
//   Clean — lifts whites, opens midtones slightly, and deepens solid blacks,
//           so the boost lands on a clean base instead of a flat one.
//
// Why two layers rather than one: each is a separate control. Turn Clean off
// and keep the colour. Halve Boost's opacity without touching contrast. This
// is the shape to copy when you build your own looks — one layer per idea.
//
// Neutrals stay out of Boost (only the six colour ranges carry weights) and
// colours stay out of Clean (only the black channel moves), so the two do not
// fight each other.
//
// Re-running replaces this script's own Boost and Clean layers and leaves
// every other layer alone, so you can tune and re-run freely.

const BOOST_STRENGTH = 0.60;  // ink weight per colour range, 0..1
const BOOST_OPACITY  = 0.40;  // how much of the boost is let through
const CLEAN_STRENGTH = 0.25;  // black-channel weight for the tonal cleanup
const CLEAN_OPACITY  = 0.30;  // how much of the cleanup is let through

const BOOST_LAYER_NAME = 'Boost';
const CLEAN_LAYER_NAME = 'Clean';

const { Document } = require('/document');
const { DocumentCommand, NodeChildType,
        AddChildNodesCommandBuilder } = require('/commands');
const { SelectiveColourAdjustmentRasterNodeDefinition,
        SelectiveColour } = require('/nodes');
const { NodeMoveType } = require('affinity:dom');
const { Selection } = require('/selections');

const doc = Document.current;
if (!doc) throw new Error('No document open — open an image and run again.');

function layerName(layer) {
  return layer.userDescription ?? layer.defaultDescription;
}

// Idempotency: remove only the layers a previous run of THIS script made.
for (const layer of doc.layers.toArray()) {
  const name = layerName(layer);
  if (name === BOOST_LAYER_NAME || name === CLEAN_LAYER_NAME) {
    doc.executeCommand(
      DocumentCommand.createDeleteSelection(Selection.create(doc, layer), true));
  }
}

function addSelectiveColourLayer(name) {
  const builder = AddChildNodesCommandBuilder.create();
  builder.addSelectiveColourAdjustmentRasterNode(
    SelectiveColourAdjustmentRasterNodeDefinition.createDefault());

  const rootCountBefore = doc.layers.toArray().length;
  const command = builder.createCommand();
  doc.executeCommand(command);
  const layer = command.newNodes[0];

  // If the top of the layer stack is a group, the builder parents the new
  // layer INSIDE it — detect (root count unchanged) and move it back out.
  const rootLayers = doc.layers.toArray();
  if (rootLayers.length === rootCountBefore) {
    doc.executeCommand(DocumentCommand.createMoveNodes(
      Selection.create(doc, layer),
      rootLayers[rootLayers.length - 1], NodeMoveType.After, NodeChildType.Main));
  }

  layer.userDescription = name;
  return layer;
}

function applyWeights(layer, weights) {
  const params = layer.parameters;
  const w = params.weights;
  for (const [range, ink] of weights) {
    w[range.value] = ink;
  }
  params.weights = w;
  params.isRelative = true;
  doc.executeCommand(DocumentCommand.createSetSelectiveColourAdjustmentParameters(
    Selection.create(doc, layer), params));
}

function setOpacity(layer, opacity) {
  doc.selection = Selection.create(doc, layer);
  doc.setOpacity(opacity);
  doc.selection = null;
}

function ink(cyanWeight, magentaWeight, yellowWeight, blackWeight) {
  return { cyanWeight, magentaWeight, yellowWeight, blackWeight };
}

// Clean goes in first so Boost ends up above it: tone first, then colour.
const c = CLEAN_STRENGTH;
const clean = addSelectiveColourLayer(CLEAN_LAYER_NAME);
applyWeights(clean, [
  [SelectiveColour.Whites,   ink(0, 0, 0, -c)],          // lift the highlights
  [SelectiveColour.Neutrals, ink(0, 0, 0, -c * 0.5)],    // open the midtones
  [SelectiveColour.Blacks,   ink(0, 0, 0,  c * 0.65)],   // keep blacks solid
]);
setOpacity(clean, CLEAN_OPACITY);

// Each range: + its primary inks, − its complement ink.
const s = BOOST_STRENGTH;
const boost = addSelectiveColourLayer(BOOST_LAYER_NAME);
applyWeights(boost, [
  [SelectiveColour.Reds,     ink(-s,  s,  s, 0)],
  [SelectiveColour.Greens,   ink( s, -s,  s, 0)],
  [SelectiveColour.Blues,    ink( s,  s, -s, 0)],
  [SelectiveColour.Cyans,    ink( s, -s, -s, 0)],
  [SelectiveColour.Magentas, ink(-s,  s, -s, 0)],
  [SelectiveColour.Yellows,  ink(-s, -s,  s, 0)],
]);
setOpacity(boost, BOOST_OPACITY);

console.log(
  'Two-layer Color Boost added — Boost (strength ' + s + ', opacity ' +
  Math.round(BOOST_OPACITY * 100) + '%) over Clean (strength ' + c +
  ', opacity ' + Math.round(CLEAN_OPACITY * 100) + '%)');
