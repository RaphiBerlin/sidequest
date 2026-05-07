INSERT INTO quests (id, title, description, duration_min, xp, context_tags) VALUES

(gen_random_uuid(),
 'The Human Sundial',
 'Find a tall structure casting a sharp shadow on flat ground — a lamppost, monument, or building corner. Place a small object (a coin, your shoe) at the exact tip of the shadow and note the time. Return in 10 minutes and photograph both the original marker and the new shadow tip in the same frame. Proof of the sun moving counts as proof of patience.',
 20, 75, ARRAY['urban', 'suburban', 'universal']),

(gen_random_uuid(),
 'Corner Store Fossil',
 'Enter any convenience or corner store and find the single item with the oldest sell-by or manufacture date still on a shelf. Photograph the item and its date label in clear focus together. Bonus: ask the cashier how long it has been there and include their answer in your submission.',
 20, 100, ARRAY['commercial']),

(gen_random_uuid(),
 'Shadow Portrait',
 'Find a clean flat surface where your shadow falls sharply — pavement, a wall, a sandy path. Arrange your silhouette into the most striking shape you can: a monster, a dancer, an animal, a letter. Photograph the shadow from directly above or dead-on. The human body stays out of frame; only the shadow counts as the subject.',
 15, 50, ARRAY['universal']),

(gen_random_uuid(),
 'Three Strangers, One Spot',
 'Ask three different strangers the same question: "What''s your favourite place within walking distance of here?" Note all three answers, then visit at least one of the spots. Photograph your group at the recommended location with a handwritten note showing whose recommendation it was.',
 25, 150, ARRAY['urban', 'suburban', 'commercial']),

(gen_random_uuid(),
 'The Secret Green',
 'Find a patch of grass, plants, or trees completely hidden from any main road — a courtyard, a space behind a building, a gap between blocks. The green must be invisible from where you started. Photograph your group inside it with the surrounding walls or structures clearly visible, proving how hidden it is.',
 25, 125, ARRAY['urban', 'suburban', 'park']),

(gen_random_uuid(),
 'The Last Payphone',
 'Hunt on foot for a public payphone that is still installed — no GPS navigation allowed, walking and looking only. When you find one, photograph someone in your group with the receiver to their ear, fully committed to the bit. If no payphone exists, a booth shell or a plaque marking a former location counts for half credit.',
 25, 150, ARRAY['urban', 'transit']),

(gen_random_uuid(),
 'Still Water Mirror',
 'Find a body of still water — a fountain basin, a puddle, a pond, a canal — and compose a photograph in which the reflection is the clear main subject. The reflected image must be more visually interesting than what''s above the waterline. Upside-down buildings and sky qualify; a muddy blur does not.',
 20, 75, ARRAY['water', 'park', 'urban']),

(gen_random_uuid(),
 'Dead End Discovery',
 'Find a dead-end street, alley, or cul-de-sac you have never walked down before. Go to the very end and photograph whatever is there — a wall, a gate, an unexpected garden, a surprising view. The photograph must show the terminal point clearly. Describe in one sentence what you found.',
 20, 100, ARRAY['urban', 'suburban']),

(gen_random_uuid(),
 'The Oldest Trunk',
 'Find the tree with the widest trunk in the nearest park or green space — judge by eye, no measuring tape. Try to wrap your arms around it; if you have a group, attempt a full human ring. Photograph the attempt whether you succeed or not, with the canopy visible above. Widest you can find wins.',
 25, 100, ARRAY['park', 'nature']),

(gen_random_uuid(),
 'Five Textures, Five Blocks',
 'Photograph five radically different surface textures found within five blocks of your starting point: one rough, one smooth, one soft, one sharp-edged, and one you struggle to name. Each photo must show a bare hand touching the surface. All five must be distinct materials — concrete and tarmac count as one.',
 15, 75, ARRAY['universal', 'urban', 'suburban']),

(gen_random_uuid(),
 'Graffiti Face',
 'Search walls, shutters, and underpasses for graffiti or street art containing a recognisable human face — not a logo, not a tag, an actual face. Photograph someone in your group beside it making the exact same expression. Neutral for neutral, angry for angry. Both faces must be visible in the same frame.',
 20, 75, ARRAY['urban']),

(gen_random_uuid(),
 'Transit Confessor',
 'At any bus stop, train platform, or transit hub, find someone waiting and ask: "Where are you headed today?" Have at least a two-minute conversation about it. Photograph the stop sign or platform number with a handwritten note showing the destination they named. They do not need to appear in the photo.',
 25, 125, ARRAY['transit', 'urban']),

(gen_random_uuid(),
 'The Shortest Named Street',
 'Using only your feet and eyes — no GPS — find the shortest named street in your current neighbourhood. A lane, mews, passage, or court qualifies. Stand at one end and photograph straight down its full length so both ends are visible in a single frame. The street sign must appear in the shot.',
 25, 125, ARRAY['urban', 'suburban']),

(gen_random_uuid(),
 'Macro World',
 'Select any small, overlooked object — a bolt, a crack in the pavement, a petal, an insect, a coin — and get your camera physically as close as possible without digital zoom. The photograph must make the subject look monumental, like a building or landscape. Alongside it, submit a second shot showing the object next to your hand for scale.',
 15, 50, ARRAY['universal']),

(gen_random_uuid(),
 'Ghost Business',
 'Find a shuttered or abandoned commercial space that still displays visible traces of its former identity — old signage, peeling paint, a menu in the window, original tiles. Photograph the facade with the remnants clearly visible. In your submission, name what type of business you think it was and why.',
 25, 125, ARRAY['urban', 'commercial', 'suburban']),

(gen_random_uuid(),
 'The Park Regular',
 'Find someone who appears to be a regular fixture in the park — a daily dog walker, a person always on the same bench, someone doing morning tai chi. Introduce yourselves, ask how long they have been coming here, and have at least a five-minute conversation. Photograph the spot they use, with or without them in frame (their choice).',
 30, 200, ARRAY['park']),

(gen_random_uuid(),
 'Underpass Archaeology',
 'Find a railway or road underpass and examine its walls closely. Most accumulate layers of paint, posters, and tags over decades. Locate the oldest-looking layer — faded lettering, a half-buried mural, a dated tag — and photograph it with a finger pointing directly at the detail. Estimate how old it might be.',
 20, 100, ARRAY['transit', 'urban']),

(gen_random_uuid(),
 'Cloud Spotter',
 'Lie flat on your back somewhere outdoors and spend at least five minutes watching the sky. When a cloud clearly resembles something — an animal, a face, a country, a vehicle — photograph it immediately. On the photo, draw an arrow or outline pointing to the shape. Group disagreements about what it looks like are part of the quest.',
 15, 50, ARRAY['universal', 'park', 'nature']),

(gen_random_uuid(),
 'ROYGBIV Street',
 'On a single city block, photograph one naturally occurring object for each colour of the rainbow in strict order: red, orange, yellow, green, blue, indigo, violet. Each object must exist for a reason other than decoration — no rainbow murals, no pride flags. Seven photos, one block. Substitutions require group agreement.',
 25, 150, ARRAY['urban', 'suburban', 'commercial']),

(gen_random_uuid(),
 'Construction Archaeology',
 'Find a building under renovation or demolition where older layers are exposed — brick beneath plaster, original Victorian tiles, a ghost advert on a party wall. Photograph the exposed layer with a hand pointing at the detail. Attempt to estimate or find out from a passing worker when the original layer dates from.',
 20, 100, ARRAY['urban']),

(gen_random_uuid(),
 'The Impossible Angle',
 'Choose any well-known local landmark, building, or feature — something everyone passes without looking twice. Find the framing or position from which it looks completely unrecognisable or surreal. Submit that photograph alongside the standard "tourist" shot from the obvious spot. The contrast between the two is the proof.',
 20, 75, ARRAY['universal', 'urban', 'suburban', 'park']),

(gen_random_uuid(),
 'Breakfast for the Birds',
 'Bring or find a small amount of food — bread, seeds, or fruit — and leave it in a visible outdoor spot. Stay within five metres and wait. Photograph a bird or squirrel actively eating what you placed. Minimum ten minutes of waiting required. The food and the animal must be identifiable in the same frame.',
 20, 75, ARRAY['park', 'nature']),

(gen_random_uuid(),
 'The Reflection Double',
 'Find any reflective surface — a shop window, a polished marble wall, a parked car door, a still puddle — and frame a photograph in which one person appears twice: once directly and once in the reflection. Both versions of the person must be clearly visible and roughly equal in size within the frame.',
 20, 75, ARRAY['urban', 'suburban', 'commercial', 'water']),

(gen_random_uuid(),
 'Bench With a View',
 'Find a park or street bench with a dedication plaque — "In memory of..." or "Donated by..." Photograph the plaque in legible close-up. Then sit for at least five minutes and take a second photograph from the bench''s exact eye-line: what that person looked out at. Submit both. The contrast between name and view is the story.',
 25, 125, ARRAY['park', 'urban']),

(gen_random_uuid(),
 'The 3-Second Hello',
 'Using the 3-second rule — commit before you overthink — approach a stranger in a public space and ask if you can take a photo together for a scavenger hunt. The photograph must show at least one group member and the stranger side-by-side, both willing to be in the shot. Explain the quest to them after. Most people say yes.',
 20, 100, ARRAY['urban', 'commercial', 'suburban', 'park']);
