# Imagegen素材提示

模式：內建 imagegen。所有新增素材均以選定 `art-reference.png` 作風格參照。

## ink-mountains.png

Create a transparent-background game environment matte-painting asset derived from the attached approved Jiang Xue ink-wash scene. Preserve EXACTLY its delicate diluted Chinese ink brush style, muted neutral grey palette, incomplete broken contours, watercolor texture and sparse composition. Output only a broad panoramic range of five or six snowy Chinese mountain peaks, in multiple overlapping hazy layers, with a few tiny very sparse pale pine silhouettes on the peaks. Uneven organic craggy mountain profiles with soft hand-painted broken brush edges, not geometric triangles. Mountains at medium distance are a little deeper grey but still dilute and translucent; far shapes grey and unclear. Reserve wide negative gaps of transparency between mountain groups. The bases fade completely to transparency in a broad mist wash, with no hard horizontal baseline, ideal for a distant backdrop plane in a Three.js game. Top peaks reach toward upper part of frame; painted mass occupies middle two thirds; transparent around all outer edges. NO opaque sky, no paper-colored background, no river, boat, people, path, foreground stones, buildings, birds, text or border. The background must genuinely be transparent. A painterly asset, not a photoreal landscape and not a 3D render. Wide landscape canvas.

## ink-pine.png

Create ONE isolated snow-dusted Chinese pine tree game sprite on a genuinely transparent background. Match EXACTLY the faint hand-painted Chinese ink-wash style of the upper-left pine in the attached approved Jiang Xue reference. A gracefully leaning crooked trunk, delicate calligraphic branches, sparse wide umbrella-shaped clusters of brush-painted pine needles, very pale grey-green foliage, white snow resting in patches, uneven light-grey bark strokes. The tree should have the appearance of a three dimensional tree described with dilute brush strokes and much negative space between branches, not a photograph, not low-poly geometry, and not solid dark coloring. Whole tree visible including root foot, generous transparent margin, no ground patch. Tapered ragged brush edges, restrained darker accents along a few trunk joints, mostly pale grey and near-white. No other trees, landscape, background, mountain, river, people, birds, shadows, title, text, seal or border. Keep the trunk base centered low and branches spreading asymmetrically to the right. Transparent background required. Asset for placing among actual 3D terrain in an ink-wash exploration game.

# 立體物件表皮修訂（內建 imagegen）

以下四張方形材質均以 art-reference.png 作風格參照，包覆真實三維模型而非作屏幕濾鏡。

## brush-rock.png
Generate a square seamless 2D ALBEDO MATERIAL TEXTURE for wrapping onto actual 3D cliff and stone meshes in a Three.js game. Use the attached image ONLY as the exact ink-wash art-style and palette reference, especially the pale grey rocky vertical faces beneath the white snow. Output a FLAT TEXTURE, not a perspective scene, not a single isolated object, not a landscape. Diluted Chinese brush painting on a pale near-white stone base: expressive long downward grey dry-brush streaks, tapered uneven crag lines, branching mineral fissures, soft wet-ink blooms, fine broken bristle marks, subtly layered scumbled greys, broad unpainted pale regions. Medium-grey slender crevices occupy perhaps 15% of surface, pale grey wash 35%, the rest off-white. Very detailed authentic hand-painted brushwork, fine enough to see close up. Neutral grey only. Flat evenly lit pigment surface with no cast lighting or baked 3D shadows, no snow blobs, no river, no pines, no title, no border, no labels, no photorealistic geological texture. The four edges should tile without visible seams. This is a Chinese ink-painting outer skin for actual 3D objects.

## brush-bark.png
Generate a square seamless 2D ALBEDO MATERIAL TEXTURE for wrapping onto a twisted pine trunk and branches in a Three.js game. Match the traditional Chinese brushwork of the pale snow pine in the attached reference. FLAT evenly lit bark pigment texture, no tree silhouette, no scene, no individual branch object. Flowing mostly vertical irregular Chinese brush strokes, layered grey bark scales and small cracks, white dry-brush gaps, soft pale ink bleeding and a few narrow charcoal-grey calligraphic accents. High-resolution fine hand-painted detail, neutral pale greys with tiny grey-green hints, broadly pale and muted, not dark overall. Use expressive bristle strokes rather than realistic photo bark. Seamless tileable edges. No perspective, snow clumps, foliage, sky, mountains, text, border or labels. Material texture only, to be attached to true 3D geometry.

## brush-wood.png
Generate a square seamless 2D ALBEDO MATERIAL TEXTURE for a traditional wooden fishing skiff in a Chinese ink-wash game. Match the neutral pale-grey brush-painting style of the attached reference boat. Flat evenly lit hand-painted wood pigment texture, all grain runs mostly top to bottom: faded parallel wood grain, a few irregular tapered dry-brush knots and thin grain lines, overlapping pale ink washes, subtle long timber fibres. No plank board outlines; geometry will provide actual wooden boards. Mostly pale grey with restrained medium-grey grain, never warm brown. Crisp hand-painted details with delicate ink bleeding and unpainted gaps. Tileable four sides. No actual boat, objects, perspective, scene, title, border, labels, realistic photo grain or baked cast shadows. Actual 3D object skin, not an illustration of a boat.

## brush-straw.png
Generate a square seamless 2D ALBEDO MATERIAL TEXTURE for a fisherman straw rain cape 蓑衣 and woven conical hat 斗笠 in a Chinese ink-wash game. Use attached snowy ink-painting reference for exact pale neutral-grey art direction. Flat hand-painted pigment texture, no garment or person silhouette. Many fine irregular vertical grass fibres and thin layered straw strands in grey brushwork, delicately woven crossing threads at long intervals, very pale fabric gaps, short tapered dry-brush streaks, faint wet ink wash, authentic hand-inked details. Mostly light-grey/off-white, a few medium-grey narrow strokes, no brown or yellow. Seamless tileable edges, even diffuse lighting. No objects, people, face, hat, cape shape, landscape, title, border, labels or photorealistic fibre photograph. Surface artwork to wrap onto the actual 3D cloak and hat.

## brush-rock-v2.png、brush-bark-v2.png（實際使用）

改以原圖較寬的斑駁墨塊、斷筆及稀疏勾勒取代初稿細直紋。仍使用內建 imagegen；兩張皆以 art-reference.png 為唯一風格參照。初稿保留於資料夾供比較。

### brush-rock-v2.png

Use case: stylized-concept. Asset type: seamless square Chinese ink painting ALBEDO texture to wrap actual 3D rock cliffs in a game. Image 1 is the approved art-style reference, NOT an edit target. Match SPECIFICALLY its large pale-grey rock faces at the left foreground: broad angular wet-brush patches, overlapping soft irregular grey pigment dabs and facet-shaped washes, variable-size broken round/square brush-tip marks, white dry-brush gaps, a few sparse dark charcoal cracks with tapered calligraphic edges. It must look as if the reference painting's rock brushwork has been spread into a flat pigment sheet, preserving its grey values and hand-painted softness. Pale background, many light-grey irregular patches, some medium-grey angular blooms, very few thin dark contours. No photographic texture, no pencil hatching, NO continuous parallel vertical stripes, NO dense fine grain, NO generic stone photograph. Stroke scale is broad, with only about 8 to 14 major brush patches across the image. Mix short diagonal, horizontal and downward strokes with generous irregular blank gaps. Flat evenly lit 2D pigment surface; no scene, no mountains, no actual object silhouette, no snow, no perspective, no text, no border. Seamless tileable edges. Neutral grey only. The material will be distorted over detailed real 3D rocks, and should retain expressive Chinese ink brush marks at every angle.

### brush-bark-v2.png

Use case: stylized-concept. Asset type: seamless square Chinese ink ALBEDO texture to wrap a real 3D crooked pine trunk in a game. Image 1 is solely the exact art style reference. Match its foreground upper-left pine bark painting: irregular broad flaking grey bark scales, interrupted wet-brush patches, thin sparse black tapered twig-like fissures and small charcoal dabs, generous white dry-brush gaps. Broad broken hand-painted shapes, each irregular bark scale a little angular, not a dense fine-line texture. Some longer downward strokes but they must be interrupted by white and grey patches; no continuous parallel lines, no uniform vertical stripes, no wood-grain fibres, no photographic bark. Pale neutral grey palette, softly bleeding larger light-grey and medium-grey patches, a few dark expressive accents. Flat evenly lit material artwork, no actual tree or branch silhouette, no snow, no perspective, no scene, no text, no border. Tileable edges. Each direction must look like genuine calligraphic Chinese painting brushwork, visually matching the reference pine.

## ink-rounded-ranges.png（0.4.0 環繞遠山）

內建 imagegen；以 art-reference.png 為風格參照，透明素材。

Use case: stylized-concept
Asset type: transparent game-environment mountain panorama texture for a 360-degree ring of layered cylinders
Input images: Image 1 is a style reference only; use its pale Chinese ink-wash brush language, broken contours, mist, and restrained values. Do not recreate the reference composition and do not include its river, boat, fisherman, or foreground path.
Primary request: create one very wide horizontal transparent-alpha panorama of distant Chinese ink mountains for a semi-open 3D scene. Show about eight separate but visually connected mountain groups with varied heights and widths. The mountain silhouettes should be broad, rounded, naturally softened and irregular, with lower hills continuing between groups. Avoid a row of thin upright pillars, sharp triangular peaks, repeated identical silhouettes, or large empty gaps down to the base.
Scene/backdrop: no visible backdrop; the entire canvas outside the mountain forms must be transparent. The mountain band should occupy the middle and lower portion, with a soft mist fade that becomes completely transparent toward the bottom and transparent outer side edges so the panorama can wrap around cylinders.
Subject: layered distant mountain ranges only, with a few extremely fine pale stylized pine silhouettes sparsely placed on some ridges.
Style/medium: hand-painted Chinese shui-mo ink wash, layered cun-brush strokes and soft ink diffusion, pale snow left as white negative space, broken calligraphic ridge contours, simplified game-asset silhouette; preserve the reference's very light gray Chinese painting touch. It must read as an illustrated texture/cutout, not a photograph and not a 3D render.
Composition/framing: extra-wide 3:1-like panoramic strip; eight varied rounded mountain clusters distributed across the width; overlapping atmospheric layers; continuous low foothills between clusters; no central hero peak.
Lighting/mood: cold, quiet, wintry, fog-softened, mostly low contrast with a few restrained darker ink accents on nearer ridges.
Color palette: mostly black, white, and cool gray ink; only extremely subtle gray-blue or gray-green tint if needed; no saturated colors.
Materials/textures: visible layered dry-brush and wet-ink washes, irregular broken edges, soft transparent atmospheric falloff; do not use uniform vector fills, smooth gradients alone, or regular repeating texture.
Text (verbatim): none.
Constraints: true transparent alpha background; transparent top, bottom, and outer side margins; bottom mist fade fully transparent; standalone mountain panorama only; keep every mountain group broad and rounded; preserve clear separation between near/middle/far ink layers.
Avoid: sky, paper texture, parchment, solid white background, river, water, shoreline, rocks, canyon, boat, fisherman, characters, buildings, roads, text, logos, frame, border, flat opaque rectangle, photorealism, realistic landscape photography, 3D render, thin needle-like peaks, sharp repeated triangles, all peaks the same height, mountain silhouettes cut off at the edges.


## brush-path.png（冬泥碎礫路面）

模式：內建 imagegen（首次生成後一次針對性水墨化編輯）；不使用 CLI。最終採用第二張實際生成的方形圖片，保留原始輸出，複製到 `dist/assets/brush-path.png`。此素材為中性灰路面 albedo，供世界座標重複貼圖使用；沒有道路外形、透視、白邊或鋪磚行列。

### 首次生成提示（原文）

Use case: stylized-concept
Asset type: seamless square top-down ALBEDO MATERIAL TEXTURE for a winter mud-and-gravel footpath in a Chinese ink-wash Three.js game.
Primary request: create a flat, edge-to-edge, tileable hand-painted pigment surface of exposed winter mud, charcoal-gray and stone-gray fine crushed gravel, scattered tiny snow grains, and irregular dry-brush ink fibres. This is ONLY the road's surface skin; the game geometry provides the road shape.
Style/medium: detailed traditional Chinese brush painting, diluted neutral gray wet ink washes overlaid with expressive broken dry-brush bristle marks, soft ink blooms, little irregular mottled patches, very fine hand-painted gravel dabs and scumbled winter mud. It must look painted by hand in ink, not photographed, not a 3D render, and not a uniform cartoon fill.
Composition/framing: exact square canvas, perfectly overhead orthographic material swatch, entire frame covered by the same continuous ground surface. Balanced non-directional distribution of marks at small and medium scales, no central subject, no decorative composition, no visible path perimeter. All four edges should join seamlessly when repeated.
Color palette: strictly neutral greys. Predominantly muted medium stone-gray and charcoal-gray exposed ground, with restrained darker gray broken ink accents and occasional light-gray or near-white tiny snow grains. Overall medium grey, never solid black; avoid a white paper base. Sparse snow flecks must not become large white patches. No brown, tan, yellow, blue, green or saturated color. The shader will control final brightness.
Materials/textures: diffuse painted albedo only, even lighting, no baked cast shadows, no shiny wet highlights. Gravel should be fine crushed irregular grains distributed naturally, not large cobblestones. Preserve soft hand-painted irregularity and delicate fibre detail for close-up gameplay.
Constraints: no road outline, no perspective, no vanishing point, no paving rows, no grid, no repeated board or tile pattern, no border, no white-background margins, no empty white corners, no isolated object, no trees, leaves, roots, branches, buildings, people, footprints, river, mountain, text, lettering, signature, logo, seal, frame, or watermark. Opaque seamless texture, no transparency.

### 最終選用編輯提示（原文）

Use case: style-transfer
Asset type: seamless square top-down hand-painted Chinese ink albedo for a 3D winter mud-and-gravel path.
Input image: Image 1 is the edit target, the first generated neutral grey ground texture.
Primary request: keep the same square full-coverage overhead neutral grey mud-and-fine-gravel material and sparse light snow grains, but repaint it much more clearly as traditional Chinese ink brushwork. The current fine texture looks too close to a photograph. Replace photographic-looking pebble modelling with irregular short charcoal-grey brush-tip dabs, simplified stone-grey gravel flecks, scumbled drybrush fibres, and broad soft wet-ink blooms. Use about 10 to 16 loose medium-scale overlapping brush washes across the image, with detailed broken bristle marks inside them. Make individual gravel marks flat expressive ink dabs with no realistic cast shadows or glossy surfaces.
Invariants: seamless tileable square; no visible road perimeter, no perspective, no scene, no central object, no paving grid or rows, no white-background margins. Entire canvas remains a continuous muted medium-grey ground sheet, neither white paper nor solid black. Keep strictly neutral charcoal-grey, stone-grey, light-grey and occasional tiny off-white snow grains; no brown or other color. Even diffuse albedo, no baked lighting.
Style/medium: authentic detailed Chinese shui-mo painting, wet and dry ink on paper, expressive soft irregular brush edges, small pale broken gaps distributed throughout the grey. It should look visibly painted from every viewing distance, not like a desaturated gravel photo and not like a 3D render.
Avoid: large white snow patches, blank white border, texture vignette, path outline, tree, leaf, root, footprints, object, text, logo, signature, stamp, frame or watermark.

輸入編輯目標：首次生成的中性灰冬泥碎礫材質。
最終原始檔：`/Users/charles/.codex/generated_images/01a13e90-6325-7902-92bb-8c7752a906a2/exec-3f31b823-0e94-4a1f-9564-0ec958d9c490.png`。
建議：世界座標約 0.23 repeats/m，疊加旋轉的低強度第二次取樣，以約 0.6 權重融入道路墨洗；依近景調整。

## 0.9 馬車與馬匹專用筆墨圖集（2026-10-16）

模式：內建 imagegen；以已選定的 `dist/assets/art-reference.png` 作風格參考，一次生成。原始輸出保留，複製至 `dist/assets/rig-brush-atlas-v1.png`。圖集由上至下為馬毛乾筆、舊木纖維及淡墨布紋。材質僅用於馬匹與馬車，配合淡墨表面、飛白邊緣及薄墨暈層；不改動風景和孤舟材質。墨鳥羽毛以原生曲面及淡墨 shader 製作，沒有新增外部依賴。

原始檔：`/Users/charles/.codex/generated_images/01a13e54-5ebd-7b11-9967-8923eaf81aab/exec-ecbe1fdd-f678-48f4-8b9c-fc3acfea594a.png`。

### 生成提示詞（原文）

Create a 2D production texture atlas for a Chinese ink wash game, using the attached landscape only as a style reference. OUTPUT ONLY FLAT MATERIAL MARKS, NOT A SCENE OR ANY OBJECT. One square image, divided into three equal horizontal bands stacked vertically with absolutely no borders, gutter, labels, text or frames. The TOP third: pale silver grey horse hair and fur represented by beautifully irregular Chinese dry-brush strokes, fine flowing hair lines, occasional broad smoky grey washes, broken brush tips and plentiful untouched paper; the horse itself must NOT be pictured. The MIDDLE third: aged wood represented by elegant long thin mostly vertical charcoal grey wood grain brush strokes, subtle irregular knots and dry calligraphic streaks, grey ink bleeding softly into white paper; NOT actual boards, no seams. The BOTTOM third: extremely pale off-white linen wash with quiet fine fibres, a few light silver grey fold strokes, softly blooming watery edges, lots of empty white. All marks should feel hand painted with traditional Chinese brush on fine rice paper. Restrained palette of cool light greys, only a few small medium grey or charcoal accents, no brown, no saturated colour. Match the light, delicate, atmospheric brushwork of the reference rather than its mountains. No lighting, no 3D relief, no realistic photographic material, no square speckle patterns, no solid dark patches. Very detailed thin dry brushwork over broad delicate fluid washes, high resolution.
# 1.0 已批准設計的立體材質與宣紙（2026-10-16）

馬車、馬匹、墨鳥及五件行李均由實際三維曲面組成。以下圖像貼在曲面上或用於原生 DOM 彈窗；沒有以整幅設計圖取代遊玩場景。

## brush-surface-atlas-v2.png

內建 imagegen。六格由左至右、由上至下：馬毛淡墨、順向木紋、亞麻布、官帽布紋、宣紙纖維、飛白墨筆。馬身採局部座標三向投影，木板、布料及紙面採 UV；材質載入完成後才開放進場。原始圖保留於生成資料夾，生產檔位於 `dist/assets/brush-surface-atlas-v2.png`。

原始檔：`/Users/charles/.codex/generated_images/01a13e54-5ebd-7b11-9967-8923eaf81aab/exec-da347801-d3b7-4156-a21c-43203a808ff6.png`。

生成提示詞（原文）：

Use case: stylized-concept
Asset type: PRODUCTION 3D DIFFUSE PIGMENT MATERIAL ATLAS, not a scene or object illustration.
Input image 1 is the approved horse/cart style reference. Input image 2 is the approved collectible material reference. Match their actual brush pigments and pale grey values. Do not draw any of their objects.
Layout: a single wide rectangular canvas with EXACTLY SIX equal material tiles, THREE columns and TWO rows, touching edge to edge, NO gutters, borders, frames or labels. Every tile is completely filled with flat diffuse material paint. All textures have no lighting, no cast shadows, no perspective or 3D relief.
TOP LEFT: horse coat pigment, medium-light stone-grey wet ink washes, broad softly overlapping irregular patches, a few sparse broken dry-brush fibres, generous thin pale areas, subtle dark grey accents, no mane or animal anatomy. NOT long flowing hair, not swirling waves, no stripes or uniform micro-speckles.
TOP MIDDLE: aged grey timber pigment, long mostly vertical sparse dry charcoal grain strokes, natural broken fibres and occasional understated knots, plenty of pale grey rubbed wash between strokes. No actual wooden boards, joints or hard repeating bands.
TOP RIGHT: pale grey linen/canvas pigment, softly uneven woven fibres, delicate diagonal wrinkles and quiet pale brush blooms, almost white in many places, no large folds or actual cloth silhouette.
BOTTOM LEFT: soft charcoal-grey official-cap cloth pigment, diluted medium-dark grey ink patches, broken grey cloth fibres and subtle broad fold wash, varied dark and light grey, never a flat solid black square.
BOTTOM MIDDLE: cool white xuan paper fibres with very pale ash-grey ink blooms and tiny irregular absorbent fibres, blank paper, no handwriting or characters, no stains or aged yellow tint.
BOTTOM RIGHT: sparse tapered Chinese dry-brush stroke pigment on pure white; several long irregular charcoal-grey stroke ribbons running mainly vertically, frayed brush-tip bristles, broken white gaps and very pale dilute trails, no bird or feather drawing. This is sampled along real 3D wing and mane ribbons.
Overall: authentic delicate hand-painted shui-mo pigments with fine paper character and broad transparent wash. Greyscale throughout, no saturated colour, brown, sepia, red or decorative seal. Do not make a generic photographic texture. These materials will wrap real 3D meshes, so do not put subject outlines or object shapes in the tiles.

## xuan-paper-panel-v2.png

內建 imagegen，以已批准的 `04-pickup-popup.png` 作編輯參考；移除文字、物件及場景，只保留具有透明不齊紙邊的白灰宣紙。生產檔位於 `dist/assets/xuan-paper-panel-v2.png`。原始檔：`/Users/charles/.codex/generated_images/01a13e54-5ebd-7b11-9967-8923eaf81aab/exec-6caff9ca-e431-4291-9965-aaebfc5f7932.png`。

生成提示詞（原文）：

Use the attached approved game UI mockup as the material and shape reference. Generate ONLY a blank isolated single sheet of traditional Chinese xuan paper, portrait 3:4 aspect ratio, straight front view, centered nearly filling canvas. Match its cool off-white fibrous hand-made paper with subtle pale gray dilute ink bloom near the edges, soft deckled torn irregular edges and fine creases, very light with lots of clean writing space in middle. Genuine transparency around the sheet; no drop shadow, absolutely NO text, calligraphy, objects, cap, art, mountains, frames, UI, symbols or buttons. This is a production blank UI background asset. White/gray only, no beige/yellow/brown. Beautiful softly irregular watercolor brush fibers; middle mostly clear. Preserve paper material from reference, remove everything else.

## 文字與幾何

霞鶩文楷 TC v1.522，來源 https://github.com/lxgw/LxgwWenKaiTC/releases/tag/v1.522 ，SIL OFL 1.1 授權，完整授權附於 `dist/assets/fonts/OFL-1.1.txt`。

馬匹的連續曲面以 `scripts/build-horse.mjs` 離線建立，生產網格為 `dist/assets/models/horse-v2.bin`，31,456 頂點、62,908 三角面，具完整 UV、單位平滑法線與一個連通表面。馬具、蹄、鬃尾另有實際曲面；宣紙層使用相同曲面偏移，避免層間穿插。

以下保留先前素材的完整生成紀錄；本版五張插圖紀錄附於文件末段。


# Approved five-item UI cutouts

Mode: built-in imagegen, transparent_background: true. Each generation references the approved board at /Users/charles/Documents/Codex/2026-10-15/i-am-a-chinese-teacher-in/outputs/jiangxue-design-preview-v2/03-five-items.png. These PNG illustrations are for pickup popups/journal; they do not replace the actual textured 3D meshes.

All final PNGs are RGBA with fully transparent corners (alpha 0), verified by a read-only PNG decoder. The scroll, map and farewell have clean outside silhouettes. The cap and decree retain a faint soft white-grey halo outside their edges; a targeted imagegen cleanup attempt did not remove it, so the original closer-to-board versions were retained. On a pale paper popup this soft light halo should blend, but inspect against the chosen UI backdrop.

## hat

Final: `/Users/charles/Documents/Codex/2026-10-15/i-am-a-chinese-teacher-in/outputs/jiangxue-prototype/dist/assets/props-v2/hat.png`

Dimensions: 1536 × 1024. Original retained: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-37e727ad-87b9-4332-b6a8-8d1b00e66a55.png`.

Prompt:

```text
Use case: background-extraction. Asset type: transparent watercolor ink illustration for a historical game pickup popup. Input image is the approved five-object design board; extract and faithfully redraw ONLY the TOP LEFT object, the soft dark Tang-style cloth official cap with two short trailing cloth ties. Preserve its exact low rounded folded crown, soft cloth folds, charcoal grey ink wash, detailed broken dry-brush fibres, irregular soft edges and pale highlights; do not make a shiny 3D render. Center the whole cap and all ties with comfortable margin, three-quarter view matching the reference. ONE complete cap only. Genuine transparent alpha background. No background paper, no ground, no cast shadow, no labels, no numerals, no calligraphy, no border, no watermark. Exclude the other four objects.
```

## scroll

Final: `/Users/charles/Documents/Codex/2026-10-15/i-am-a-chinese-teacher-in/outputs/jiangxue-prototype/dist/assets/props-v2/scroll.png`

Dimensions: 1672 × 941. Original retained: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-1bb6118e-0a18-4cb8-8b6c-f53fc118c7c9.png`.

Prompt:

```text
Use case: background-extraction. Asset type: transparent watercolor ink illustration for historical game UI. The attached approved design board is the reference. Faithfully extract and redraw ONLY its TOP MIDDLE object: the linen-wrapped reform-writing tube, diagonally lower-left to upper-right, with paper scroll ends visible and a central grey cord tied in a small loop and hanging knot. Keep the same silhouette, delicate pale grey woven linen, hand-painted dry brush, soft grey wash shadows and imperfect frayed edges. Center the complete single object with all ties in frame and comfortable margin. Genuine transparent alpha background, clean outside silhouette; no background wash or glow, no paper backdrop, ground, cast shadow, labels, numerals, text, border, watermark or any other object. Not a photorealistic or plastic 3D render.
```

## decree

Final: `/Users/charles/Documents/Codex/2026-10-15/i-am-a-chinese-teacher-in/outputs/jiangxue-prototype/dist/assets/props-v2/decree.png`

Dimensions: 1536 × 1024. Original retained: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-7e5b48d3-27f1-443f-9db1-dc5762dcd780.png`.

Prompt:

```text
Use case: background-extraction. Asset type: transparent watercolor ink illustration for a historical game pickup popup. The attached five-object board is the approved reference. Faithfully extract and redraw ONLY the TOP RIGHT object: the folded demotion document, a slim rectangular layered bundle of old pale paper at three-quarter angle lower-left to upper-right, irregular torn soft edges, sparse small vertical brush-script marks on its top, secured across the middle by a thin grey cloth tie with small knot and loose ends. Match the board's exact pale charcoal-grey watercolor washes, rice-paper fibres, delicate dry-brush outlines, generous paper white, and softly imperfect folds. ONE complete paper bundle only, centered with margin. Genuine transparent alpha background. No background wash, glow, paper backdrop, ground, cast shadow, label or item name, numerals, border, watermark, cap, scroll, map or letter. No modern envelope.
```

## map

Final: `/Users/charles/Documents/Codex/2026-10-15/i-am-a-chinese-teacher-in/outputs/jiangxue-prototype/dist/assets/props-v2/map.png`

Dimensions: 1672 × 941. Original retained: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-694ca8dc-fc83-4b10-bc77-80a67f655f0c.png`.

Prompt:

```text
Use case: background-extraction. Asset type: transparent watercolor ink illustration for a historical game pickup popup. Input is the approved five-object design board. Faithfully extract and redraw ONLY the BOTTOM LEFT object: an irregular unfolded soft cloth route map. Preserve its wide low silhouette, gently curled frayed fabric edges, grey ribbon tied at the left side with loose trailing ends, fold creases, several little pale Chinese ink-wash mountains and one meandering dark dashed route ending in a tiny circle. Match the approved board's delicate Chinese brushwork, grey wash, paper-white gaps and textured linen fibres. A single cloth map, angled in the same shallow three-quarter perspective, wholly in frame with comfortable margin. Genuine transparent alpha background, with clean outside silhouette. No background wash or glow, no backdrop, ground, cast shadow, item labels, numerals, border, watermark, or other objects. Not a terrain diorama or realistic 3D render.
```

## farewell

Final: `/Users/charles/Documents/Codex/2026-10-15/i-am-a-chinese-teacher-in/outputs/jiangxue-prototype/dist/assets/props-v2/farewell.png`

Dimensions: 1672 × 941. Original retained: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-358b0cc6-3140-484f-8df3-b7890868df84.png`.

Prompt:

```text
Use case: background-extraction. Asset type: transparent watercolor ink illustration for a historical game pickup popup. Input image is the approved five-item board. Faithfully extract and redraw ONLY the BOTTOM RIGHT object: the partly-open old folded farewell letter, a horizontal pale soft paper sheet with a raised central fold, thin faded handwritten vertical lines on the left and middle panels, and the exact clear brush-written Traditional Chinese characters "珍重" vertically on the right panel (珍 above 重). A grey cloth ribbon lies loose and partly tucked underneath on the left. Preserve the approved object's silhouette, shallow three-quarter view, irregular deckled paper edges, pale grey watercolor wash, rice-paper fibres, broken dry-brush linework and tender quiet feeling. Center ONE complete letter with all ribbon in frame and comfortable margin. Genuine transparent alpha background with clean outside silhouette. No background wash or glow, backdrop paper, ground, cast shadow, label, item name, numerals, border, watermark, or any other object. No modern envelope, wax seal or postage stamp.
```

## Discarded targeted cleanup attempts

The generated cleanup variants were inspected but not copied into the project, since they kept the soft outside halo and introduced warmer tonal drift.

### hat

Original output: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-549ed015-b33b-4227-a579-6885b77b005f.png`

```text
Use case: background-extraction. Image 1 is the edit target: a watercolor cloth cap cutout. Image 2 is the approved five-object board for style reference. Make precisely one correction to Image 1: REMOVE the grey glowing haze around the outside of the cap and its ties. The only pixels with nonzero alpha should belong to the cap's actual cloth silhouette and its small frayed brush-painted fibres. Everything else must be truly transparent, not blurred grey or white. Keep the complete cap, proportions, folds, detailed grey dry-brush texture, position, and all ties unchanged. Do not add a cast shadow, background, glow, text, border or other object. Genuine transparent alpha background.
```

### decree

Original output: `/Users/charles/.codex/generated_images/01a1435a-f70c-7732-a97d-680bf5e75aff/exec-9ccb2bb0-b6bc-4c2a-b010-e329a41b256e.png`

```text
Use case: background-extraction. Image 1 is the edit target: the folded demotion document watercolor cutout. Image 2 is the approved five-object board for style reference. Make precisely one correction to Image 1: REMOVE the grey glowing haze around the outside of the paper bundle and tie. The only pixels with nonzero alpha should belong to the document's actual deckled paper silhouette, cord and its tiny frayed brush-painted fibres. Everything else must be genuinely transparent, not blurred grey or white. Keep the complete paper bundle, proportions, folds, delicate handwritten lines, detailed pale grey dry-brush texture, angle, position, and all cord unchanged. Do not add a cast shadow, backdrop, glow, labels, border or other object. Genuine transparent alpha background.
```
