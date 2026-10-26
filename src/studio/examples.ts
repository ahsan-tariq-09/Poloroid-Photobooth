import {
  addDecoration,
  cutLayer,
  initialComposition,
  repeatLayer,
  type Asset,
  type Composition,
} from "../model";
import { loadImage } from "../imports";

export type ExampleDefinition = {
  id: "classic" | "collage" | "grid";
  title: string;
  description: string;
  asset: "sample";
  composition: Composition;
};

function exampleComposition(kind: ExampleDefinition["id"]): Composition {
  let c = initialComposition();
  c.layers[0].name = "Vintage party photo";
  if (kind === "collage") {
    c = cutLayer(
      c,
      c.layers[0].id,
      [
        [-10, 190],
        [470, 270],
      ],
      "straight",
    );
    c.layers[0].rotation = -5;
    c.layers[0].y -= 12;
    c.layers[1].rotation = 4;
    c.layers[1].y += 14;
    c = addDecoration(c, "tape", "#d8b88a");
    Object.assign(c.layers.at(-1)!, {
      x: 217,
      y: 272,
      width: 160,
      height: 39,
      rotation: -12,
    });
  } else if (kind === "grid") {
    c = repeatLayer(c, c.layers[0].id);
  }
  c.layers.forEach((layer, index) => {
    layer.id = `example-${kind}-${index}`;
  });
  return c;
}

export const examples: ExampleDefinition[] = [
  {
    id: "classic",
    title: "Classic",
    description: "One photo, a simple frame.",
    asset: "sample",
    composition: exampleComposition("classic"),
  },
  {
    id: "collage",
    title: "Cut and taped",
    description: "Two pieces, joined with tape.",
    asset: "sample",
    composition: exampleComposition("collage"),
  },
  {
    id: "grid",
    title: "3×3 grid",
    description: "Nine photos in one frame.",
    asset: "sample",
    composition: exampleComposition("grid"),
  },
];

let sample: Promise<Asset> | undefined;
export function loadSample(): Promise<Asset> {
  return (sample ??= loadImage("/sample-flash.webp")
    .then((image) => ({
      image,
      url: "/sample-flash.webp",
      name: "Vintage party photo",
      width: image.naturalWidth,
      height: image.naturalHeight,
    }))
    .catch((error) => {
      sample = undefined;
      throw error;
    }));
}
