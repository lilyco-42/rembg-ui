// ZIP writer reused from the desktop product workflow.
        export function createZip(layers) {
            if (!layers.length) return;
            const crcTable = (function() {
                const t = new Uint32Array(256);
                for (let n = 0; n < 256; n++) {
                    let c = n;
                    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
                    t[n] = c >>> 0;
                }
                return t;
            })();
            function crc32(bytes) {
                let c = 0xFFFFFFFF;
                for (let i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
                return (c ^ 0xFFFFFFFF) >>> 0;
            }
            function u16(n) { return new Uint8Array([n & 255, (n >>> 8) & 255]); }
            function u32(n) { return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]); }
            function cat(parts) {
                const len = parts.reduce((s, p) => s + p.length, 0);
                const out = new Uint8Array(len);
                let o = 0;
                for (const p of parts) { out.set(p, o); o += p.length; }
                return out;
            }
            const locals = [];
            const centrals = [];
            let offset = 0;
            layers.forEach((layer, i) => {
                const name = (layer.name || ("layer_" + (i + 1) + ".png")).replace(/[\\/:*?"<>|]+/g, "_");
                const nameBytes = new TextEncoder().encode(name);
                const comma = (layer.image || "").indexOf(",");
                const b64 = comma >= 0 ? layer.image.slice(comma + 1) : "";
                const bin = atob(b64);
                const data = layer.bytes || new Uint8Array(bin.length);
                if (!layer.bytes) for (let j = 0; j < bin.length; j++) data[j] = bin.charCodeAt(j);
                const crc = crc32(data);
                const local = cat([
                    new Uint8Array([0x50,0x4b,0x03,0x04, 0x14,0x00, 0x00,0x08, 0x00,0x00, 0x00,0x00, 0x00,0x00]),
                    u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0),
                    nameBytes, data
                ]);
                const central = cat([
                    new Uint8Array([0x50,0x4b,0x01,0x02, 0x14,0x00, 0x14,0x00, 0x00,0x08, 0x00,0x00, 0x00,0x00, 0x00,0x00]),
                    u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
                    u32(0), u32(offset), nameBytes
                ]);
                locals.push(local);
                centrals.push(central);
                offset += local.length;
            });
            const centralBlob = cat(centrals);
            const eocd = cat([
                new Uint8Array([0x50,0x4b,0x05,0x06, 0x00,0x00, 0x00,0x00]),
                u16(layers.length), u16(layers.length),
                u32(centralBlob.length), u32(offset), u16(0)
            ]);
            const zip = cat([...locals, centralBlob, eocd]);
            return new Blob([zip], {type: "application/zip"});
        }
