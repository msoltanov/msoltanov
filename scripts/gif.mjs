const BLOCK = {
  extension: 0x21,
  image: 0x2c,
  trailer: 0x3b,
  control: 0xf9,
  application: 0xff,
};

export function inspectGif(bytes) {
  const invalid = () => {
    throw new Error('Invalid animated GIF.');
  };
  if (!Buffer.isBuffer(bytes)) {
    invalid();
  }
  let cursor = 0;
  const take = (length) => {
    if (length > bytes.length - cursor) {
      invalid();
    }
    const value = bytes.subarray(cursor, cursor + length);
    cursor += length;
    return value;
  };
  const byte = () => take(1)[0];
  const table = (packed) => {
    if (packed & 128) {
      take(3 * 2 ** ((packed & 7) + 1));
    }
  };
  const blocks = () => {
    const chunks = [];
    for (let length = byte(); length !== 0; length = byte()) {
      chunks.push(take(length));
    }
    return chunks;
  };
  const header = take(13);
  if (header.subarray(0, 6).toString() !== 'GIF89a') {
    invalid();
  }
  const width = header.readUInt16LE(6);
  const height = header.readUInt16LE(8);
  if (!width || !height) {
    invalid();
  }
  table(header[10]);
  const frames = [];
  let loops = null;
  let delay = 0;
  let duration = 0;
  for (let marker = byte(); marker !== BLOCK.trailer; marker = byte()) {
    if (marker === BLOCK.extension) {
      const kind = byte();
      const chunks = blocks();
      if (kind === BLOCK.control) {
        if (chunks.length !== 1 || chunks[0].length !== 4) {
          invalid();
        }
        delay = chunks[0].readUInt16LE(1) * 10;
      }
      if (
        kind === BLOCK.application &&
        chunks[0]?.toString() === 'NETSCAPE2.0'
      ) {
        if (
          chunks.length !== 2 ||
          chunks[1].length !== 3 ||
          chunks[1][0] !== 1
        ) {
          invalid();
        }
        loops = chunks[1].readUInt16LE(1);
      }
      continue;
    }
    if (marker !== BLOCK.image) {
      invalid();
    }
    const descriptor = take(9);
    const frameWidth = descriptor.readUInt16LE(4);
    const frameHeight = descriptor.readUInt16LE(6);
    if (
      !frameWidth ||
      !frameHeight ||
      descriptor.readUInt16LE(0) + frameWidth > width ||
      descriptor.readUInt16LE(2) + frameHeight > height
    ) {
      invalid();
    }
    table(descriptor[8]);
    const codeSize = byte();
    if (codeSize < 2 || codeSize > 8) {
      invalid();
    }
    const chunks = blocks();
    if (!chunks.length) {
      invalid();
    }
    frames.push(Buffer.concat(chunks));
    duration += delay;
    delay = 0;
  }
  if (cursor !== bytes.length || !frames.length) {
    invalid();
  }
  return { frames, loops, duration, width, height };
}
