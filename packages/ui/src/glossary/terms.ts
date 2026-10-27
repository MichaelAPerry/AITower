/**
 * The single source of truth for datacenter vocabulary. The Primer's "Speak the language" blocks, the Words reference,
 * and every <Term> hover in the HUD read from this list. Pure data.
 *
 * `def` is the real, industry-standard definition (one line). `game` says how AItower shows or simplifies it; it
 * completes the sentence "In AItower, ...". `at` is where the Primer teaches it (a chapter id, or "words" for reference only).
 */
export interface TermDef {
	id: string;
	/** Name as printed in the Words list. */
	name: string;
	/** Extra search words (spellings, expansions, neighbours). */
	aka?: string;
	def: string;
	game: string;
	at: string;
}

export const TERMS: readonly TermDef[] = [
	// What is a datacenter
	{ id: "it-load", name: "IT load", aka: "critical load it power", def: "Power drawn by the computing equipment itself (servers, storage, network), not the cooling and overhead around it.", game: "shown as \"Computer power (IT load)\" in Insights → Details. Cooling load is roughly equal to it, since every watt becomes heat.", at: "ch:what" },
	{ id: "rack", name: "Rack", aka: "cabinet server", def: "A standard 19-inch cabinet that holds servers, storage or network gear. It is the basic unit a datacenter is built, powered and cooled by.", game: "the thing that earns. It needs power, cooling and repairs.", at: "ch:what" },
	{ id: "pflops", name: "PFLOPS (PF)", aka: "pf petaflops flops compute", def: "Petaflops: 10^15 floating-point operations per second. The standard yardstick for AI compute (a GPU's rating depends on the numeric precision used).", game: "the unit of compute, shown as PF. Contracts ask for PF-hours of work. AItower quotes one simple number per rack.", at: "ch:what" },
	{ id: "training", name: "Training", aka: "model training job", def: "Building an AI model by running one huge calculation over data, for hours to weeks. Throughput matters; latency does not.", game: "a one-off contract with a deadline. It pays when the work is done.", at: "ch:what" },
	{ id: "inference", name: "Inference", aka: "serving", def: "Running a trained model to answer requests. It is a steady service: capacity must be there whenever users ask.", game: "a streaming contract. It pays per minute you keep up and fines you if capacity falls short.", at: "ch:what" },
	// Power
	{ id: "kw", name: "kW", aka: "kilowatt watts", def: "Kilowatt: 1,000 watts, a rate of power use.", game: "rack and plant ratings. A rack is tens of kW.", at: "ch:power" },
	{ id: "capacity", name: "Capacity", aka: "rating ceiling maximum limit supply", def: "The most power (or cooling) a supply can deliver. Load has to stay below it.", game: "grid intakes, generators and air handlers each list their capacity; the lesson goal bar compares it with the load.", at: "ch:power" },
	{ id: "headroom", name: "Headroom", aka: "margin spare reserve", def: "Capacity minus load: the margin that absorbs a spike or a failed unit. Operators size for it on purpose.", game: "the lesson goal bar shows it as a percentage of capacity.", at: "ch:power" },
	{ id: "mw", name: "MW", aka: "megawatt", def: "Megawatt: 1,000 kW. Facilities are sized and sold in MW; a large hyperscale campus is tens to hundreds.", game: "grid intakes and big towers are quoted in MW.", at: "ch:power" },
	{ id: "kwh", name: "kWh", aka: "kilowatt-hour energy", def: "Kilowatt-hour: energy, meaning 1 kW used for one hour. Electricity is billed by it.", game: "the grid price in Insights is dollars per kWh and changes through the day.", at: "ch:power" },
	{ id: "rack-density", name: "Rack density (kW per rack)", aka: "density kw per rack", def: "Power drawn by one rack. Traditional racks drew 5 to 10 kW; AI racks run 40 to 130 kW and beyond, which is why cooling had to change.", game: "each rack's Power row in the Build Inspector. Density sets which cooling it needs.", at: "ch:power" },
	{ id: "pdu", name: "PDU", aka: "power distribution unit busway", def: "Power distribution unit: steps facility power down and feeds it to racks, usually through breakers. Rack PDUs sit inside the cabinet.", game: "folded into conduits, the power lines under the floor.", at: "ch:power" },
	{ id: "ups", name: "UPS", aka: "uninterruptible power supply battery", def: "Uninterruptible power supply: batteries that carry the load for seconds to minutes, until a generator starts or grid power returns.", game: "a battery building. It holds the tower through gaps before a generator is up.", at: "ch:power" },
	{ id: "genset", name: "Genset", aka: "generator backup diesel", def: "Generator set: an engine-driven generator for long outages. It takes seconds to start, which is why a UPS bridges the gap.", game: "starts after a short delay when supply runs short, and burns pricey fuel.", at: "ch:power" },
	{ id: "redundancy", name: "N+1 (redundancy)", aka: "n+1 2n redundant failover spare", def: "N is the units needed to carry the load. N+1 adds one spare so any single failure is survivable; 2N duplicates the whole system.", game: "build one more generator, battery or air handler than the load needs. Formal tiers (2N and so on) are not modelled.", at: "ch:power" },
	{ id: "brownout", name: "Brownout", aka: "sag undervoltage shortage", def: "Supply below demand, so equipment gets less than it needs. (Strictly, a voltage sag; in AItower it means a power shortfall.)", game: "machines slow down; with no power at all they stop and show NO POWER.", at: "ch:power" },
	// Heat
	{ id: "crah", name: "CRAH", aka: "computer room air handler fan coil air handler", def: "Computer room air handler: fans blow room air across a coil of chilled water. It needs a chiller plant behind it.", game: "the air handler building. It cools racks within its reach.", at: "ch:heat" },
	{ id: "crac", name: "CRAC", aka: "computer room air conditioner dx", def: "Computer room air conditioner: a self-contained unit with its own compressor (direct expansion). A CRAH has no compressor and relies on chilled water.", game: "not built. Air handlers here are CRAH-style and draw on a chiller.", at: "ch:heat" },
	{ id: "aisle", name: "Hot/cold aisle containment", aka: "hot aisle cold aisle containment ducting", def: "Racks face each other across a cold aisle that gets supply air. Hot exhaust collects behind them. Physical barriers stop the two mixing, so cooling needs less air and less energy.", game: "a cooling research step (ducted exhaust, sealed aisle ends) raises air-handler capacity by a few percent.", at: "ch:heat" },
	{ id: "chiller", name: "Chiller", aka: "chilled water plant cooling tower", def: "A machine that cools water and sends it around a loop. It rejects the heat outdoors and is usually the largest cooling energy user.", game: "makes cold water for coolant loops. It works less well in hot weather.", at: "ch:heat" },
	{ id: "cdu", name: "CDU", aka: "coolant distribution unit manifold", def: "Coolant distribution unit: a heat exchanger and pumps that link the facility water loop to the clean coolant loop feeding the racks' cold plates.", game: "shares a chiller's cold between liquid racks. Racks on a loop are capped by its capacity.", at: "ch:heat" },
	{ id: "dlc", name: "Direct-to-chip liquid cooling (DLC)", aka: "dlc cold plate liquid cooling direct liquid", def: "Cold plates sit on the processors and coolant flows through them, removing most of the heat. Fans still handle the rest. It handles densities air cannot.", game: "liquid-cooled racks need a coolant pipe, a chiller and a CDU.", at: "ch:heat" },
	{ id: "immersion", name: "Immersion cooling", aka: "immersion tank dielectric single-phase two-phase", def: "Servers sit in a bath of dielectric (non-conductive) fluid that carries heat to a heat exchanger. It cools very dense hardware and removes fans.", game: "an immersion rack sits in a tank and needs a coolant loop, like liquid racks.", at: "ch:heat" },
	{ id: "pue", name: "PUE", aka: "power usage effectiveness efficiency", def: "Power usage effectiveness: total facility power divided by IT power. 1.0 is perfect; typical hyperscale sites run about 1.1 to 1.2, older ones 1.5 or more.", game: "shown in Insights → Details as \"Cooling cost (PUE)\", with a gauge in the gauges panel.", at: "ch:heat" },
	{ id: "wue", name: "WUE", aka: "water usage effectiveness water", def: "Water usage effectiveness: litres of water used per kWh of IT energy. Evaporative cooling lowers PUE but raises WUE.", game: "not tracked. The cooling-tower chiller is the water-hungry kit.", at: "ch:heat" },
	{ id: "tdp", name: "TDP", aka: "thermal design power watts chip", def: "Thermal design power: the heat a chip is designed to shed under sustained load, in watts. The cooling must be able to remove it. Top AI GPUs are 700 W and above.", game: "a rack's kW draw stands in for the sum of its chips' TDP.", at: "ch:heat" },
	{ id: "throttle", name: "Thermal throttling", aka: "throttle slow down hot", def: "A chip that gets too hot cuts its clock speed to protect itself. You still pay for the power but get less compute.", game: "a hot rack shows HOT and delivers less PF. Past the trip temperature it shuts off.", at: "ch:heat" },
	{ id: "cop", name: "COP", aka: "coefficient of performance", def: "Coefficient of performance: heat moved per unit of electricity spent moving it. Higher means cheaper cooling.", game: "the \"Thrift\" row on cooling machines.", at: "ch:heat" },
	{ id: "heat-reuse", name: "Heat reuse", aka: "waste heat district heating heat export", def: "Selling or piping a datacenter's waste heat to something useful, such as district heating. Liquid cooling returns hotter water, which makes this practical.", game: "heat export buildings sell heat to the neighbourhood and count toward the Greentech score.", at: "ch:heat" },
	// Reliability
	{ id: "mtbf", name: "MTBF", aka: "mean time between failures failure rate", def: "Mean time between failures: average running time between breakdowns of a repairable part. A fleet of thousands of parts sees failures daily even when each part is reliable.", game: "each rack's Breaks row. Heat makes them break sooner.", at: "ch:break" },
	{ id: "mttr", name: "MTTR", aka: "mean time to repair recovery", def: "Mean time to repair: how long a fix takes. Availability is about MTBF ÷ (MTBF + MTTR), so fast repair raises uptime as surely as reliable parts do.", game: "bot walking and repair time, plus how stocked the depot is.", at: "ch:break" },
	{ id: "checkpointing", name: "Checkpointing", aka: "checkpoint save progress rollback", def: "Saving a training job's state periodically so a failure rolls back to the last save, not to zero.", game: "training jobs have a checkpoint interval. A rack that drops out costs the job the work since the last one.", at: "ch:break" },
	// Uptime
	{ id: "uptime", name: "Uptime", aka: "availability", def: "The share of time a service or facility was available.", game: "measured daily across your racks. Contracts depend on it, and the quarterly inspection grades it.", at: "ch:uptime" },
	{ id: "nines", name: "Nines", aka: "99.9 three nines five nines", def: "Uptime written as a count of nines: 99.9% (three nines) allows about 8.8 hours of downtime a year; 99.99% about 53 minutes; 99.999% about 5 minutes.", game: "Level targets run from 93% to 97%. Each extra nine is much harder.", at: "ch:uptime" },
	{ id: "sla", name: "SLA", aka: "service level agreement penalty", def: "Service-level agreement: the contract promise to a customer, with penalties (credits or fines) if it is missed.", game: "inference contracts fine you while a running service falls short.", at: "ch:uptime" },
	{ id: "slo", name: "SLO", aka: "service level objective target", def: "Service-level objective: the internal target you aim to beat so the SLA is never at risk. It is stricter than the SLA.", game: "each Level's uptime target works like an SLO. Miss it and the quarterly inspection fines you.", at: "ch:uptime" },
	// Money
	{ id: "capex", name: "Capex vs opex", aka: "capex opex capital operating expense", def: "Capital expenditure is money spent building and buying equipment; operating expenditure is the running cost (power, staff, maintenance). Datacenters are capex-heavy, and power dominates opex.", game: "build costs are capex. The daily upkeep and power bill are opex.", at: "ch:money" },
	{ id: "utilisation", name: "Utilisation", aka: "utilization idle occupancy", def: "The share of capacity doing paid work. An idle server still draws power and depreciates, so utilisation drives margin.", game: "racks with no job earn nothing but still cost upkeep, so keep a contract running.", at: "ch:money" },
	{ id: "ppa", name: "PPA", aka: "power purchase agreement electricity contract renewable", def: "Power purchase agreement: a long-term contract to buy electricity (often from wind or solar) at a fixed price. It trades spot-price risk for certainty.", game: "occasional memos offer a solar PPA. Otherwise you pay the live grid price.", at: "ch:money" },
	// Reference only
	{ id: "overlay", name: "Overlay", def: "A colour layer over the floor plan.", game: "Heat, Power and Coolant overlays show where each is short.", at: "words" },
	{ id: "rp", name: "RP", aka: "research points", def: "A game term, not an industry one: research points earned by delivering compute.", game: "spent in the Research drawer on new machines and perks.", at: "words" },
	{ id: "tick", name: "Tick", def: "A step of a simulation.", game: "one game minute.", at: "words" },
];

const BY_ID = new Map(TERMS.map((t) => [t.id, t]));
export const termById = (id: string): TermDef | undefined => BY_ID.get(id);
