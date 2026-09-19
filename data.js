// Activity dataset for Bored — Singapore edition.
//
// Fields:
//   id, text, minMinutes
//   cost: 'free' | 'under10' | '10to30' | '30plus'  — typical SGD price band per person
//   energy: 'low' | 'med' | 'high'
//   location: 'indoor' | 'outdoor' | 'any'           — user-facing filter
//   weatherSensitive: boolean                         — true if genuinely spoiled by rain
//                                                        (used for automatic weather filtering,
//                                                        independent of `location` — a covered
//                                                        hawker centre is technically "outdoor"
//                                                        but isn't weather-sensitive)
//   area: 'Islandwide' | 'Central' | 'East' | 'West' | 'North' | 'North-East' | 'South'
//   tags: string[] — tags[0] is the primary category shown as a badge
const ACTIVITIES = [
  { id: 1, text: "Try the chicken rice at Maxwell Food Centre, then wander Chinatown.", minMinutes: 30, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['hawker', 'food'] },
  { id: 2, text: "Go for satay street food at Lau Pa Sat once the tables spill onto the street at night.", minMinutes: 30, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['hawker', 'food'] },
  { id: 3, text: "Explore Old Airport Road Food Centre — one of the island's most storied hawker centres.", minMinutes: 30, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'East', tags: ['hawker', 'food'] },
  { id: 4, text: "Browse Tiong Bahru Market: hawker food downstairs, wet market upstairs.", minMinutes: 30, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['hawker', 'food'] },
  { id: 5, text: "Head to Chomp Chomp Food Centre in Serangoon for a late supper.", minMinutes: 30, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'North-East', tags: ['hawker', 'food'] },
  { id: 6, text: "Try BBQ seafood and stingray at Newton Food Centre.", minMinutes: 45, cost: '10to30', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['hawker', 'food'] },
  { id: 7, text: "Grab a quick lunch at Amoy Street Food Centre with the CBD crowd.", minMinutes: 20, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['hawker', 'food'] },
  { id: 8, text: "Sample Indian and Malay food at Tekka Centre, then browse Little India.", minMinutes: 45, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['hawker', 'food'] },
  { id: 9, text: "Eat seafood by the water at East Coast Lagoon Food Village.", minMinutes: 45, cost: '10to30', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'East', tags: ['hawker', 'food'] },
  { id: 10, text: "Try a supper run at Ghim Moh Market — the fishball noodles queue is worth it.", minMinutes: 30, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'West', tags: ['hawker', 'food'] },

  { id: 11, text: "Cycle or skate the full stretch of East Coast Park.", minMinutes: 60, cost: 'free', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'East', tags: ['nature', 'physical'] },
  { id: 12, text: "Walk the Singapore Botanic Gardens and the National Orchid Garden.", minMinutes: 60, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['nature', 'relaxation'] },
  { id: 13, text: "See the Supertree Grove at Gardens by the Bay, free to walk around at ground level.", minMinutes: 30, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['nature', 'adventure'] },
  { id: 14, text: "Hike the TreeTop Walk loop at MacRitchie Reservoir.", minMinutes: 90, cost: 'free', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['nature', 'physical'] },
  { id: 15, text: "Walk the Southern Ridges from Mount Faber to HortPark via Henderson Waves.", minMinutes: 90, cost: 'free', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'South', tags: ['nature', 'physical'] },
  { id: 16, text: "Take the bumboat to Pulau Ubin from Changi Point and rent a bike for the day.", minMinutes: 120, cost: '10to30', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'East', tags: ['adventure', 'physical'] },
  { id: 17, text: "Walk the mangrove boardwalk at Sungei Buloh Wetland Reserve and look for birds.", minMinutes: 60, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'North', tags: ['nature', 'relaxation'] },
  { id: 18, text: "Stroll Bishan-Ang Mo Kio Park along the river — keep an eye out for otters.", minMinutes: 30, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['nature', 'relaxation'] },
  { id: 19, text: "Explore the rustic trails of Coney Island Park.", minMinutes: 60, cost: 'free', energy: 'med', location: 'outdoor', weatherSensitive: true, area: 'North-East', tags: ['nature', 'adventure'] },
  { id: 20, text: "Climb Fort Canning Park and read up on its layered history along the way.", minMinutes: 45, cost: 'free', energy: 'med', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['nature', 'learning'] },
  { id: 21, text: "Wander Jurong Lake Gardens, including the Chinese and Japanese Garden sections.", minMinutes: 60, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'West', tags: ['nature', 'relaxation'] },
  { id: 22, text: "Walk or cycle a stretch of the Rail Corridor, the old railway line turned greenway.", minMinutes: 60, cost: 'free', energy: 'med', location: 'outdoor', weatherSensitive: true, area: 'West', tags: ['nature', 'physical'] },

  { id: 23, text: "Visit the Buddha Tooth Relic Temple and Sri Mariamman Temple in Chinatown.", minMinutes: 30, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['heritage', 'learning'] },
  { id: 24, text: "Walk through Kampong Glam: Sultan Mosque, then shop-hop along Haji Lane.", minMinutes: 45, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['heritage', 'shopping'] },
  { id: 25, text: "Explore Little India: Sri Veeramakaliamman Temple and the shophouses on Campbell Lane.", minMinutes: 45, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['heritage', 'learning'] },
  { id: 26, text: "See a Southeast Asian art exhibition at National Gallery Singapore.", minMinutes: 90, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['culture', 'learning'] },
  { id: 27, text: "Visit the Asian Civilisations Museum on the riverside.", minMinutes: 60, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['culture', 'learning'] },
  { id: 28, text: "Wander the Peranakan Museum on Armenian Street.", minMinutes: 60, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['culture', 'learning'] },
  { id: 29, text: "Spend an hour in the permanent galleries at the National Museum of Singapore.", minMinutes: 60, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['culture', 'learning'] },
  { id: 30, text: "Visit Thian Hock Keng Temple on Telok Ayer Street, one of the oldest Hokkien temples here.", minMinutes: 20, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['heritage', 'learning'] },
  { id: 31, text: "Walk the eccentric diorama statues of Haw Par Villa.", minMinutes: 45, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'West', tags: ['heritage', 'creative'] },
  { id: 32, text: "Take photos at Merlion Park with the Marina Bay skyline behind you.", minMinutes: 20, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['adventure', 'creative'] },

  { id: 33, text: "Walk through the Cloud Forest and Flower Dome at Gardens by the Bay.", minMinutes: 90, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['adventure', 'nature'] },
  { id: 34, text: "See an exhibit at the ArtScience Museum by Marina Bay Sands.", minMinutes: 90, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['culture', 'learning'] },
  { id: 35, text: "Take the family to Science Centre Singapore in Jurong East.", minMinutes: 120, cost: '10to30', energy: 'med', location: 'indoor', weatherSensitive: false, area: 'West', tags: ['learning', 'family'] },
  { id: 36, text: "Spend a day at Singapore Zoo in Mandai.", minMinutes: 180, cost: '30plus', energy: 'med', location: 'outdoor', weatherSensitive: false, area: 'North', tags: ['family', 'adventure'] },
  { id: 37, text: "Do the Night Safari at Mandai after dark.", minMinutes: 120, cost: '30plus', energy: 'med', location: 'outdoor', weatherSensitive: false, area: 'North', tags: ['adventure', 'family'] },
  { id: 38, text: "Walk through River Wonders and see the giant pandas.", minMinutes: 120, cost: '30plus', energy: 'med', location: 'outdoor', weatherSensitive: false, area: 'North', tags: ['family', 'adventure'] },
  { id: 39, text: "Visit the S.E.A. Aquarium on Sentosa.", minMinutes: 90, cost: '30plus', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'South', tags: ['family', 'adventure'] },
  { id: 40, text: "Watch the Rain Vortex and walk Canopy Park at Jewel Changi Airport.", minMinutes: 60, cost: 'free', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'East', tags: ['adventure', 'family'] },

  { id: 41, text: "Spend a beach day at Siloso, Palawan, or Tanjong Beach on Sentosa.", minMinutes: 120, cost: 'free', energy: 'med', location: 'outdoor', weatherSensitive: true, area: 'South', tags: ['adventure', 'relaxation'] },
  { id: 42, text: "Try kayaking at Kallang Riverside Park.", minMinutes: 60, cost: '10to30', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['physical', 'adventure'] },
  { id: 43, text: "Try stand-up paddleboarding at East Coast Park.", minMinutes: 60, cost: '10to30', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'East', tags: ['physical', 'adventure'] },
  { id: 44, text: "Try wakeboarding at a cable ski park along East Coast.", minMinutes: 60, cost: '30plus', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'East', tags: ['physical', 'adventure'] },
  { id: 45, text: "Go night cycling along the East Coast Park round-island route.", minMinutes: 90, cost: 'free', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'East', tags: ['physical', 'adventure'] },
  { id: 46, text: "Take the ferry from Marina South Pier to Kusu Island or St John's Island for the day.", minMinutes: 180, cost: '10to30', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'South', tags: ['adventure', 'relaxation'] },
  { id: 47, text: "Swim laps at a public swimming complex near you.", minMinutes: 45, cost: 'under10', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'Islandwide', tags: ['physical'] },
  { id: 48, text: "Try a session at an indoor climbing gym.", minMinutes: 60, cost: '10to30', energy: 'high', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['physical', 'adventure'] },

  { id: 49, text: "Wander VivoCity by the Harbourfront waterfront.", minMinutes: 60, cost: 'free', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'South', tags: ['shopping', 'relaxation'] },
  { id: 50, text: "Window-shop down Orchard Road through ION Orchard and the malls nearby.", minMinutes: 60, cost: 'free', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Central', tags: ['shopping', 'relaxation'] },
  { id: 51, text: "Book a KTV room for a karaoke session with friends.", minMinutes: 120, cost: '10to30', energy: 'med', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['social', 'creative'] },
  { id: 52, text: "Go bowling at a neighbourhood bowling alley.", minMinutes: 60, cost: 'under10', energy: 'med', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['social', 'physical'] },
  { id: 53, text: "Spend an afternoon at a board game café.", minMinutes: 90, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['social', 'creative'] },
  { id: 54, text: "Try to escape an escape room with friends.", minMinutes: 60, cost: '10to30', energy: 'med', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['social', 'adventure'] },
  { id: 55, text: "Bounce around a trampoline park for an hour.", minMinutes: 60, cost: '10to30', energy: 'high', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['physical', 'family'] },
  { id: 56, text: "Catch a movie at your nearest cineplex.", minMinutes: 120, cost: '10to30', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['relaxation', 'social'] },

  { id: 57, text: "Take a heritage walk through Tiong Bahru and pop into BooksActually.", minMinutes: 60, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['heritage', 'shopping'] },
  { id: 58, text: "Shop-hop the indie fashion stores along Haji Lane and Arab Street.", minMinutes: 60, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['shopping', 'creative'] },
  { id: 59, text: "Walk through Katong and Joo Chiat's Peranakan shophouses.", minMinutes: 60, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'East', tags: ['heritage', 'creative'] },
  { id: 60, text: "Coffee-shop hop through Tanjong Pagar's back lanes.", minMinutes: 45, cost: 'under10', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['relaxation', 'social'] },
  { id: 61, text: "Café and bar hop around Holland Village in the evening.", minMinutes: 90, cost: '10to30', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['social', 'relaxation'] },
  { id: 62, text: "Take an evening stroll down Ann Siang Hill and Club Street.", minMinutes: 45, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: false, area: 'Central', tags: ['relaxation', 'social'] },
  { id: 63, text: "Browse the galleries and greenery of Dempsey Hill.", minMinutes: 60, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['creative', 'relaxation'] },
  { id: 64, text: "Walk the mangrove boardwalk and playground at Pasir Ris Park.", minMinutes: 45, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'East', tags: ['nature', 'family'] },
  { id: 65, text: "Cycle along Punggol Waterway Park.", minMinutes: 60, cost: 'free', energy: 'med', location: 'outdoor', weatherSensitive: true, area: 'North-East', tags: ['nature', 'physical'] },
  { id: 66, text: "Take a quiet stroll through Toa Payoh Town Park.", minMinutes: 30, cost: 'free', energy: 'low', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['relaxation', 'nature'] },

  { id: 67, text: "Join a free outdoor group workout — many community centres and parks run one.", minMinutes: 45, cost: 'free', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'Islandwide', tags: ['physical', 'social'] },
  { id: 68, text: "Try a drop-in yoga class at a nearby studio.", minMinutes: 60, cost: '10to30', energy: 'med', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['physical', 'relaxation'] },
  { id: 69, text: "Take a trial Muay Thai or boxing class.", minMinutes: 60, cost: '10to30', energy: 'high', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['physical'] },
  { id: 70, text: "Cycle a stretch of the Park Connector Network near you.", minMinutes: 45, cost: 'free', energy: 'med', location: 'outdoor', weatherSensitive: true, area: 'Islandwide', tags: ['physical', 'nature'] },
  { id: 71, text: "Hike the Summit Trail at Bukit Timah Nature Reserve.", minMinutes: 90, cost: 'free', energy: 'high', location: 'outdoor', weatherSensitive: true, area: 'Central', tags: ['nature', 'physical'] },
  { id: 72, text: "Do a 20-minute stretch or mobility routine at home.", minMinutes: 20, cost: 'free', energy: 'low', location: 'indoor', weatherSensitive: false, area: 'Islandwide', tags: ['relaxation', 'physical'] },
];

if (typeof module !== 'undefined') module.exports = ACTIVITIES;
