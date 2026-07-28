'use strict';
// test-color-boost.js
//
// Two-layer test script based on openai-color-boost-two-layer.js for Affinity Photo MCP SDK.
// Adds two independently adjustable Selective Colour layers:
//   1. Boost (Test) — increases colour separation across six chromatic ranges.
//   2. Clean (Test) — clears whites and neutrals while deepening solid blacks.
//
// Re-running is safe: earlier "Boost (Test)" and "Clean (Test)" layers are automatically cleaned up.

const BOOST_STRENGTH = 0.12;
const BOOST_OPACITY  = 0.25;
const CLEAN_STRENGTH = 0.06;
const CLEAN_OPACITY  = 0.30;

const BOOST_LAYER_NAME = 'Boost (Test)';
const CLEAN_LAYER_NAME = 'Clean (Test)';

const { Document } = require('/document');
const {
  DocumentCommand,
  NodeChildType,
  AddChildNodesCommandBuilder
} = require('/commands');
const {
  SelectiveColourAdjustmentRasterNodeDefinition,
  SelectiveColour
} = require('/nodes');
const { NodeMoveType } = require('affinity:dom');
const { Selection } = require('/selections');

const doc = Document.current;
if (!doc) {
  throw new Error('No document open in Affinity — please open an image or document first.');
}

console.log('--- Starting Two-Layer Color Boost Test Script ---');
console.log('Target Document UUID: ' + doc.sessionUuid);

function getLayerName(layer) {
  return layer.userDescription ?? layer.defaultDescription;
}

// 1. Idempotency: Remove existing test layers if present
let deletedCount = 0;
for (const layer of doc.layers.toArray()) {
  const name = getLayerName(layer);
  if (name === BOOST_LAYER_NAME || name === CLEAN_LAYER_NAME) {
    doc.executeCommand(
      DocumentCommand.createDeleteSelection(Selection.create(doc, layer), true)
    );
    deletedCount++;
  }
}
if (deletedCount > 0) {
  console.log('Cleaned up ' + deletedCount + ' previous test layer(s).');
}

// Helper to create and position a Selective Colour adjustment layer
function addSelectiveColourLayer(name) {
  const rootCountBefore = doc.layers.toArray().length;
  const builder = AddChildNodesCommandBuilder.create();
  builder.addSelectiveColourAdjustmentRasterNode(
    SelectiveColourAdjustmentRasterNodeDefinition.createDefault()
  );

  const command = builder.createCommand();
  doc.executeCommand(command);
  const layer = command.newNodes[0];

  if (!layer) {
    throw new Error('Failed to create Selective Colour node for layer: ' + name);
  }

  // If Affinity nested the layer inside a top group, move it back to root
  const rootLayers = doc.layers.toArray();
  if (rootLayers.length === rootCountBefore) {
    doc.executeCommand(
      DocumentCommand.createMoveNodes(
        Selection.create(doc, layer),
        rootLayers[rootLayers.length - 1],
        NodeMoveType.After,
        NodeChildType.Main
      )
    );
  }

  layer.userDescription = name;
  return layer;
}

function setLayerOpacity(layer, opacity) {
  doc.selection = Selection.create(doc, layer);
  doc.setOpacity(opacity);
  doc.selection = null;
}

function inkWeights(cyanWeight, magentaWeight, yellowWeight, blackWeight) {
  return { cyanWeight, magentaWeight, yellowWeight, blackWeight };
}

// 2. Build Layer 1: Clean (Test) - created first so it sits below Boost
const cleanLayer = addSelectiveColourLayer(CLEAN_LAYER_NAME);
const cleanParams = cleanLayer.parameters;
const cleanWeights = cleanParams.weights;
const c = CLEAN_STRENGTH;

cleanWeights[SelectiveColour.Whites.value]   = inkWeights(0, 0, 0, -c);
cleanWeights[SelectiveColour.Neutrals.value] = inkWeights(0, 0, 0, -c * 0.5);
cleanWeights[SelectiveColour.Blacks.value]   = inkWeights(0, 0, 0, c * 0.65);

cleanParams.weights = cleanWeights;
cleanParams.isRelative = true;

doc.executeCommand(
  DocumentCommand.createSetSelectiveColourAdjustmentParameters(
    Selection.create(doc, cleanLayer),
    cleanParams
  )
);
setLayerOpacity(cleanLayer, CLEAN_OPACITY);
console.log('Created Layer: "' + CLEAN_LAYER_NAME + '" (Strength: ' + c + ', Opacity: ' + Math.round(CLEAN_OPACITY * 100) + '%)');

// 3. Build Layer 2: Boost (Test) - created second so it sits above Clean
const boostLayer = addSelectiveColourLayer(BOOST_LAYER_NAME);
const boostParams = boostLayer.parameters;
const boostWeights = boostParams.weights;
const s = BOOST_STRENGTH;

boostWeights[SelectiveColour.Reds.value]     = inkWeights(-s, s, s, 0);
boostWeights[SelectiveColour.Greens.value]   = inkWeights(s, -s, s, 0);
boostWeights[SelectiveColour.Blues.value]    = inkWeights(s, s, -s, 0);
boostWeights[SelectiveColour.Cyans.value]    = inkWeights(s, -s, -s, 0);
boostWeights[SelectiveColour.Magentas.value] = inkWeights(-s, s, -s, 0);
boostWeights[SelectiveColour.Yellows.value]  = inkWeights(-s, -s, s, 0);

boostParams.weights = boostWeights;
boostParams.isRelative = true;

doc.executeCommand(
  DocumentCommand.createSetSelectiveColourAdjustmentParameters(
    Selection.create(doc, boostLayer),
    boostParams
  )
);
setLayerOpacity(boostLayer, BOOST_OPACITY);
console.log('Created Layer: "' + BOOST_LAYER_NAME + '" (Strength: ' + s + ', Opacity: ' + Math.round(BOOST_OPACITY * 100) + '%)');

console.log('Total root layers in document: ' + doc.layers.toArray().length);
console.log('--- Two-Layer Color Boost Test Completed Successfully ---');
