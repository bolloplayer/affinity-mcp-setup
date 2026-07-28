'use strict';
// openai-color-boost-two-layer.js
//
// OpenAI/Codex comparison variant of color-boost.js.
// Adds two independently adjustable Selective Colour layers:
//   Boost — increases colour separation in the six chromatic ranges.
//   Clean — gently clears whites/midtones while preserving solid blacks.
//
// Re-running is safe: earlier Boost and Clean layers are replaced.

const BOOST_STRENGTH = 0.12;
const BOOST_OPACITY = 0.25;
const CLEAN_STRENGTH = 0.06;
const CLEAN_OPACITY = 0.30;

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
if (!doc) throw new Error('No document open — open an image and run again.');

function layerName(layer) {
  return layer.userDescription ?? layer.defaultDescription;
}

// Idempotency: remove layers made by an earlier run.
for (const layer of doc.layers.toArray()) {
  if (layerName(layer) === 'Boost' || layerName(layer) === 'Clean') {
    doc.executeCommand(
      DocumentCommand.createDeleteSelection(Selection.create(doc, layer), true)
    );
  }
}

function addSelectiveColourLayer(name) {
  const builder = AddChildNodesCommandBuilder.create();
  builder.addSelectiveColourAdjustmentRasterNode(
    SelectiveColourAdjustmentRasterNodeDefinition.createDefault()
  );

  const rootCountBefore = doc.layers.toArray().length;
  const command = builder.createCommand();
  doc.executeCommand(command);
  const layer = command.newNodes[0];

  // Affinity may insert into a topmost group. Move the layer back to root.
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

function setOpacity(layer, opacity) {
  doc.selection = Selection.create(doc, layer);
  doc.setOpacity(opacity);
  doc.selection = null;
}

function inkWeights(cyanWeight, magentaWeight, yellowWeight, blackWeight) {
  return { cyanWeight, magentaWeight, yellowWeight, blackWeight };
}

// Create Clean first so Boost ends up above it in the layer stack.
const clean = addSelectiveColourLayer('Clean');
const cleanParams = clean.parameters;
const cleanWeights = cleanParams.weights;
const c = CLEAN_STRENGTH;
cleanWeights[SelectiveColour.Whites.value] =
  inkWeights(0, 0, 0, -c);
cleanWeights[SelectiveColour.Neutrals.value] =
  inkWeights(0, 0, 0, -c * 0.5);
cleanWeights[SelectiveColour.Blacks.value] =
  inkWeights(0, 0, 0, c * 0.65);
cleanParams.weights = cleanWeights;
cleanParams.isRelative = true;
doc.executeCommand(
  DocumentCommand.createSetSelectiveColourAdjustmentParameters(
    Selection.create(doc, clean),
    cleanParams
  )
);
setOpacity(clean, CLEAN_OPACITY);

const boost = addSelectiveColourLayer('Boost');
const boostParams = boost.parameters;
const boostWeights = boostParams.weights;
const s = BOOST_STRENGTH;
boostWeights[SelectiveColour.Reds.value] =
  inkWeights(-s, s, s, 0);
boostWeights[SelectiveColour.Greens.value] =
  inkWeights(s, -s, s, 0);
boostWeights[SelectiveColour.Blues.value] =
  inkWeights(s, s, -s, 0);
boostWeights[SelectiveColour.Cyans.value] =
  inkWeights(s, -s, -s, 0);
boostWeights[SelectiveColour.Magentas.value] =
  inkWeights(-s, s, -s, 0);
boostWeights[SelectiveColour.Yellows.value] =
  inkWeights(-s, -s, s, 0);
boostParams.weights = boostWeights;
boostParams.isRelative = true;
doc.executeCommand(
  DocumentCommand.createSetSelectiveColourAdjustmentParameters(
    Selection.create(doc, boost),
    boostParams
  )
);
setOpacity(boost, BOOST_OPACITY);

console.log(
  'Added Boost (' + Math.round(BOOST_OPACITY * 100) +
  '%) and Clean (' + Math.round(CLEAN_OPACITY * 100) + '%)'
);
