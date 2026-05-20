# Define Phase Overview
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: White
Authority: canonical
Last updated: 2026-05-20
The Define phase is the first step in DMAIC. Key activities:
- Create Project Charter: Problem statement, scope, goals, timeline, team members
- Identify Customers: Internal and external stakeholders
- Define CTQs (Critical to Quality): Voice of Customer translated to measurable requirements
- Map High-Level Process: SIPOC diagram (Suppliers, Inputs, Process, Outputs, Customers)
- Set Project Goals: SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)

Deliverables: Approved project charter, identified customers, CTQ definitions, SIPOC diagram.

---

# Project Charter
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
A Project Charter is a formal document that authorizes the project. Components:
1. Business Case: Why is this project important?
2. Problem Statement: What is wrong? (data-driven, specific)
3. Project Scope: What's included/excluded (In-Scope, Out-of-Scope)
4. Goals/Objectives: What will be achieved? (measurable targets)
5. Timeline: Major milestones (Define, Measure, Analyze, Improve, Control dates)
6. Team Members: Champion, Sponsor, Belt, Team members, roles
7. Resources: Budget, equipment, software needed
8. Risks: Potential obstacles and mitigation plans

Example Problem Statement: "Customer complaints about late deliveries have increased 40% in Q3 2024, from 50 to 70 per month, affecting 3 major clients."

---

# SIPOC Diagram
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
SIPOC is a high-level process mapping tool. It stands for:
- **S**uppliers: Who provides inputs? (internal/external)
- **I**nputs: What materials, information, resources are needed?
- **P**rocess: What are the 4-7 high-level steps? (verb-noun format)
- **O**utputs: What products/services are created?
- **C**ustomers: Who receives the outputs? (internal/external)

Example for Pizza Delivery:
- Suppliers: Ingredient vendors, POS system vendor
- Inputs: Dough, toppings, orders, delivery addresses
- Process: 1) Receive Order, 2) Prepare Pizza, 3) Bake, 4) Package, 5) Deliver
- Outputs: Pizza, receipt, delivery confirmation
- Customers: Hungry customers, accounting department

Use SIPOC to understand boundaries before detailed process mapping.

---

# Measure Phase Overview
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
The Measure phase collects data to quantify the problem. Key activities:
- Create Detailed Process Map: Flowchart showing all steps, decisions, handoffs
- Define Metrics: What to measure (defects, time, cost, variation)
- Data Collection Plan: What, where, when, how, who
- Measurement System Analysis (MSA): Ensure data is accurate (Gage R&R)
- Establish Baseline: Current process performance (sigma level, DPMO, Cpk)
- Assess Process Capability: Can the process meet requirements?

Deliverables: Process map, validated measurement system, baseline metrics, capability study.

Key Question: "How is the process performing today, and can we trust the data?"

---

# Data Collection Plan
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
A Data Collection Plan ensures systematic data gathering:

**What to Measure:**
- Y (Output): Primary metric (defect rate, cycle time, cost)
- X (Inputs): Potential causes (temperature, operator, material lot)
- Stratification factors: Time, shift, location, machine

**Where to Collect:**
- Specific process steps, workstations, or locations

**When to Collect:**
- Frequency: Every unit, hourly, daily, weekly
- Duration: 2 weeks, 30 days, until sample size reached
- Time of day: All shifts, specific times

**How to Collect:**
- Manual: Check sheets, forms, counters
- Automated: Sensors, software, MES systems
- Sampling: Random, systematic, stratified

**Who Collects:**
- Operators, inspectors, automatic systems

**Sample Size Calculation:**
Use formula: n = (Z² × σ²) / E²
Where: Z = confidence level (1.96 for 95%), σ = standard deviation, E = margin of error

---

# Gage R&R (Repeatability & Reproducibility)
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
Gage R&R evaluates measurement system variation. Components:

**Repeatability (Equipment Variation):**
- Same operator, same part, same setup
- Variation due to the measurement device itself
- Goal: < 10% of total variation (Excellent), < 30% (Acceptable)

**Reproducibility (Operator Variation):**
- Different operators measuring same parts
- Variation due to operator technique, training, interpretation
- Goal: < 10% of total variation

**Study Design:**
- Typical: 3 operators × 10 parts × 3 trials = 90 measurements
- Parts should represent full process range
- Randomize measurement order

**Interpreting Results:**
- %Study Var < 10%: Measurement system acceptable
- %Study Var 10-30%: May be acceptable depending on application
- %Study Var > 30%: Measurement system needs improvement

**Number of Distinct Categories (NDC):**
- NDC ≥ 5: Measurement system can detect part-to-part variation
- NDC < 5: System cannot adequately distinguish parts

**Improvement Actions:**
- Calibrate gages, train operators, standardize procedures, improve fixtures

---

# Analyze Phase Overview
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
The Analyze phase identifies root causes of the problem. Key activities:
- Analyze Process Data: Current performance vs requirements
- Identify Variation Sources: Where does variation come from?
- Root Cause Analysis: 5 Whys, Fishbone (Ishikawa), FMEA
- Hypothesis Testing: Statistical validation of potential causes
- Regression Analysis: Quantify relationships between X and Y
- Identify Vital Few: Pareto analysis to focus on significant factors

Deliverables: Verified root causes, statistical analysis results, prioritized improvement opportunities.

Key Question: "What are the root causes of defects/variation, and how do we know?"

---

# 5 Whys Root Cause Analysis
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
The 5 Whys technique digs deep to find root causes. Process:
1. Write the problem statement
2. Ask "Why does this happen?" Write the answer
3. Ask "Why?" again about that answer
4. Repeat until reaching a fundamental cause (usually 3-7 whys)
5. Verify the root cause with data

**Example: Machine stopped (production line)**
1. Why? Fuse burned out → Why?
2. Why? Not enough lubrication → Why?
3. Why? Oil pump didn't draw enough → Why?
4. Why? Oil pump not primed → Why?
5. Why? No preventive maintenance schedule

**Root Cause:** Lack of PM schedule
**Countermeasure:** Implement PM system

**Tips:**
- Focus on process, not people
- Verify each answer with facts
- Use "5" as guideline, not rule
- Multiple root paths may exist
- Combine with other tools (Fishbone, data analysis)

**When to Use:**
- Simple to moderately complex problems
- Need quick analysis
- Human/operational factors suspected

---

# Fishbone (Ishikawa) Diagram
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
The Fishbone Diagram organizes potential causes by category.

**Structure:**
- Head: Problem statement (effect)
- Spine: Main arrow pointing to head
- Bones: Categories of causes
- Sub-bones: Specific causes within each category

**Traditional 6M Categories (Manufacturing):**
- **Manpower (People):** Training, skill, fatigue, attitude
- **Method:** Procedures, standards, work instructions
- **Machine:** Equipment, tools, maintenance
- **Material:** Raw materials, components, supplies
- **Measurement:** Gages, inspection, calibration
- **Mother Nature (Environment):** Temperature, humidity, lighting

**4S Categories (Service):**
- **Surroundings:** Environment, location
- **Suppliers:** External inputs
- **Systems:** Processes, procedures
- **Skills:** Training, knowledge

**8P Categories (Service/Admin):**
- **People, Process, Place, Procedures, Policies, Product, Price, Promotion**

**How to Create:**
1. Define problem clearly
2. Draw spine and main bones (categories)
3. Brainstorm causes for each category
4. Ask "Why?" for each cause to go deeper
5. Circle most likely causes
6. Collect data to verify

---

# Improve Phase Overview
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
The Improve phase develops and implements solutions. Key activities:
- Generate Solutions: Brainstorm, benchmarking, TRIZ, Design of Experiments
- Evaluate & Select: Criteria matrix, cost-benefit analysis, risk assessment
- Pilot Solutions: Small-scale test before full implementation
- Validate Improvement: Confirm root causes addressed, targets met
- Plan Implementation: Timeline, resources, training, communication
- Design Controls: Ensure changes stick (procedures, mistake-proofing)

Deliverables: Implemented solutions, validated improvements, updated procedures, control plans.

Key Question: "How do we eliminate root causes and achieve our goals?"

**Solution Selection Criteria:**
- Effectiveness: Does it address root cause?
- Feasibility: Can we implement it?
- Cost: Implementation and operating costs
- Risk: Potential negative impacts
- Speed: How quickly can we implement?

---

# Design of Experiments (DOE)
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Black
Authority: canonical
Last updated: 2026-05-20
DOE systematically investigates factor effects on output.

**Key Concepts:**
- **Factors (X):** Inputs being studied (temperature, pressure, time)
- **Levels:** Settings for each factor (Low/High, -1/+1)
- **Response (Y):** Output being measured
- **Design:** Combination of factor levels to test
- **Replicates:** Repeat runs to assess variation

**2^k Full Factorial Design:**
- Tests all combinations of k factors at 2 levels each
- 2² = 4 runs, 2³ = 8 runs, 2⁴ = 16 runs
- Can detect main effects and all interactions

**Example: 2³ Design (3 factors)**
Run | A | B | C | Y
---|---|---|---|---
1 | -1 | -1 | -1 | 12
2 | +1 | -1 | -1 | 18
3 | -1 | +1 | -1 | 15
4 | +1 | +1 | -1 | 22
5 | -1 | -1 | +1 | 14
6 | +1 | -1 | +1 | 21
7 | -1 | +1 | +1 | 16
8 | +1 | +1 | +1 | 24

**Fractional Factorial (2^(k-p)):**
- Tests subset of full factorial
- Less runs, confounded interactions
- Good for screening many factors

**Analysis:**
- Main Effects Plot: Average Y at each factor level
- Interaction Plot: Lines parallel = no interaction
- ANOVA: Statistical significance of effects
- Regression Model: Y = β₀ + β₁A + β₂B + β₁₂AB + ε

---

# Control Phase Overview
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
The Control phase sustains improvements. Key activities:
- Document New Process: Updated SOPs, work instructions, visual aids
- Implement Monitoring: Control charts, dashboards, audits
- Create Response Plans: What to do when process drifts
- Train Personnel: Ensure everyone knows new process
- Transfer Ownership: Hand off to process owner
- Close Project: Final report, lessons learned, celebrate

Deliverables: Control plan, updated procedures, training completion, monitoring system, closed project.

Key Question: "How do we maintain the gains and prevent backsliding?"

**Control Plan Components:**
1. Process step description
2. Key metrics and specifications
3. Measurement method and frequency
4. Sample size
5. Control method (chart type, dashboard)
6. Responsibility
7. Reaction plan (out-of-control response)

---

# Statistical Process Control (SPC)
Source: src/features/comprehensive-chatbot/ComprehensiveKnowledgeBase.ts
Domain: sixsigma
Category: DMAIC
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
SPC uses control charts to monitor process stability.

**Key Concepts:**
- **Common Cause Variation:** Natural, inherent variation (random)
- **Special Cause Variation:** Assignable, unusual causes (signals)
- **Control Limits:** ±3σ from center line (99.73% of normal data)
- **Specification Limits:** Customer requirements (USL, LSL)

**Control Chart Selection:**
| Data Type | Subgroup Size | Chart |
|-----------|--------------|-------|
| Variable | n=1 | I-MR (Individuals) |
| Variable | n=2-10 | X-bar & R |
| Variable | n>10 | X-bar & S |
| Attribute (defects) | - | c-chart |
| Attribute (defectives) | - | p-chart |
| Attribute (opportunities) | - | u-chart |
| Attribute (constant n) | - | np-chart |

**Control Chart Elements:**
- UCL: Upper Control Limit
- CL: Center Line (average)
- LCL: Lower Control Limit
- Points: Sample statistics

**Out-of-Control Signals:**
1. Point outside UCL/LCL
2. 7 points trending up/down
3. 8 points on same side of center
4. 2 of 3 points in Zone A (outer third)
5. 4 of 5 points in Zone B or beyond
6. 14 points alternating up/down
7. 15 points in Zone C (middle third)

**When to Recalculate Limits:**
- Process change verified
- New equipment/method
- After removing special causes
- Regular schedule (monthly/quarterly)

---

# Process Flowchart
Source: src/features/comprehensive-chatbot/SixSigmaToolsKnowledge.ts
Domain: sixsigma
Category: Tools
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
A Process Flowchart visually represents process steps and decision points.

**Standard Symbols:**
- Oval: Start/End (Terminator)
- Rectangle: Process step (Action)
- Diamond: Decision (Yes/No branches)
- Parallelogram: Input/Output (Data)
- Arrow: Flow direction
- Document: Record or report

**Types:**
- **Top-Down:** High-level, 5-7 steps
- **Deployment (Swimlane):** Shows who does what
- **Detailed:** 20+ steps with decisions

**How to Create:**
1. Define process boundaries (start/end)
2. List all steps in order
3. Identify decision points
4. Map handoffs between people/departments
5. Add time and quality data
6. Validate with process participants

**Uses:**
- Understand current process
- Identify waste and bottlenecks
- Train new employees
- Document standard work
- Identify improvement opportunities

---

# Value Stream Map (VSM)
Source: src/features/comprehensive-chatbot/SixSigmaToolsKnowledge.ts
Domain: sixsigma
Category: Tools
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
VSM shows material and information flow from raw materials to customer.

**Key Metrics:**
- **Cycle Time (CT):** Time to complete one unit at a process step
- **Lead Time (LT):** Total time from order to delivery
- **Takt Time:** Available time / Customer demand (pace of production)
- **Process Time (PT):** Value-added time only
- **PercentC&A:** Quality at each step
- **Work in Process (WIP):** Units between steps

**Data Box Contents:**
- C/T: Cycle time
- C/O: Changeover time
- Uptime: Availability
- Shifts: Number of shifts
- PercentC&A: Quality rate
- Operators: Number of people

**Steps:**
1. Select product family
2. Map current state (walk the process)
3. Calculate metrics (LT, VA, NVA)
4. Identify waste
5. Design future state
6. Create implementation plan

---

# Pareto Chart
Source: src/features/comprehensive-chatbot/SixSigmaToolsKnowledge.ts
Domain: sixsigma
Category: Tools
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
A Pareto Chart identifies the vital few from the trivial many based on the 80/20 rule.

**Structure:**
- Bars: Frequency or impact (sorted descending)
- Line: Cumulative percentage

**The 80/20 Rule:**
- 80% of problems come from 20% of causes
- 80% of sales come from 20% of customers
- Focus on the vital few for maximum impact

**How to Create:**
1. List categories of defects/issues
2. Count frequency for each
3. Sort from highest to lowest
4. Calculate cumulative percentage
5. Draw bars and cumulative line

**Applications:**
- Defect analysis
- Customer complaints
- Downtime causes
- Inventory items
- Sales by product

---

# 5S Workplace Organization
Source: src/features/comprehensive-chatbot/SixSigmaToolsKnowledge.ts
Domain: sixsigma
Category: Tools
Belt level: Yellow
Authority: canonical
Last updated: 2026-05-20
5S creates a clean, organized, efficient workplace.

**The 5 Ss:**

**1. Sort (Seiri)** - Keep only what you need
- Remove unnecessary items
- Red tag questionable items
- Decision: Keep, Relocate, Dispose

**2. Set in Order (Seiton)** - A place for everything
- Assign specific locations
- Use labels, color coding
- Most-used items closest

**3. Shine (Seiso)** - Clean and inspect
- Clean work area thoroughly
- Inspect while cleaning
- Make cleaning routine

**4. Standardize (Seiketsu)** - Make it routine
- Create standards and procedures
- Use visual management
- Checklists and schedules

**5. Sustain (Shitsuke)** - Maintain discipline
- Training and communication
- Audits and recognition
- Management commitment

**Benefits:**
- Reduced waste
- Improved safety
- Higher quality
- Faster setup times
- Better morale

---

# Poka-Yoke (Mistake-Proofing)
Source: src/features/comprehensive-chatbot/SixSigmaToolsKnowledge.ts
Domain: sixsigma
Category: Tools
Belt level: Green
Authority: canonical
Last updated: 2026-05-20
Poka-Yoke prevents errors or makes them immediately obvious.

**Levels:**
1. **Elimination:** Design error out completely
2. **Prevention:** Physical barriers prevent error
3. **Detection:** Error detected immediately

**Types:**
- **Contact Method:** Shape prevents wrong part
- **Fixed-Value Method:** Specific number required
- **Motion-Step Method:** Sequence enforced

**Examples:**
- USB-C connector (reversible)
- Car door open warning
- SIM card tray shape
- Torque-limiting wrenches
- Dropdown lists (not free text)

**Benefits:**
- 100% inspection at source
- Reduced defects
- Lower inspection costs
- Less rework
- Safer operations

---

# EU Chemicals 1
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Chemicals
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**REACH (Registration, Evaluation, Authorization and Restriction of Chemicals)**

**Scope:** All chemical substances manufactured or imported into EU ≥ 1 tonne/year.

**Key Obligations:**
1. **Registration:** Submit dossier to ECHA for each substance
   - 1-10 tonnes: Standard registration
   - 10-100 tonnes: Extended requirements
   - 100+ tonnes: Full chemical safety report
   
2. **Evaluation:** ECHA assesses registration dossiers
   - Compliance check (formal completeness)
   - Substance evaluation (risk assessment)

3. **Authorization:** SVHC substances require specific authorization
   - Annex XIV: Authorization required
   - Sunset date: After which use is prohibited without authorization
   - Review period: Typically 4-12 years

4. **Restriction:** Annex XVII limits or bans substances
   - Currently 70+ entries covering 1000+ substances
   - Examples: Lead in jewelry, phthalates in toys, asbestos

**SVHC (Substances of Very High Concern):**
Categories:
- CMR (Carcinogenic, Mutagenic, Reprotoxic) Cat 1A/1B
- PBT (Persistent, Bioaccumulative, Toxic)
- vPvB (very Persistent, very Bioaccumulative)
- Endocrine disruptors
- Other equivalent concern

**Thresholds:**
- Article 33: Communicate SVHC > 0.1% w/w
- SCIP database notification for SVHC in articles
- Authorization list: Cannot use after sunset without permit

**Penalties:**
- Fines up to €50,000 per violation
- Criminal liability for intentional violations
- Market withdrawal of non-compliant products

---

# EU Electronics 2
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Electronics
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**RoHS (Restriction of Hazardous Substances)**

**Scope:** Electrical and electronic equipment (EEE) placed on EU market.

**Restricted Substances (maximum concentration limits):**
| Substance | Limit (ppm) | CAS Number |
|-----------|-------------|------------|
| Lead (Pb) | 1000 | 7439-92-1 |
| Mercury (Hg) | 1000 | 7439-97-6 |
| Cadmium (Cd) | 100 | 7440-43-9 |
| Hexavalent Chromium (CrVI) | 1000 | 18540-29-9 |
| PBB (Polybrominated Biphenyls) | 1000 | Various |
| PBDE (Polybrominated Diphenyl Ethers) | 1000 | Various |
| DEHP | 1000 | 117-81-7 |
| BBP | 1000 | 85-68-7 |
| DBP | 1000 | 84-74-2 |
| DIBP | 1000 | 84-69-5 |

**EEE Categories:**
1. Large household appliances
2. Small household appliances
3. IT and telecommunications equipment
4. Consumer equipment
5. Lighting equipment
6. Electrical and electronic tools
7. Toys, leisure, and sports equipment
8. Medical devices (from 2021)
9. Monitoring and control instruments
10. Automatic dispensers
11. Other EEE not covered above

**Exemptions:**
- Valid for specific applications (Annexes III and IV)
- Must be renewed periodically
- Examples: Lead in glass, mercury in lamps, cadmium in semiconductors

**Compliance Marking:**
- CE marking required
- Technical documentation
- Declaration of Conformity (DoC)

**Penalties:**
- Product withdrawal
- Fines vary by member state (up to €100,000+)
- Criminal prosecution for severe cases

---

# EU Waste 3
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Waste
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**WEEE (Waste Electrical and Electronic Equipment)**

**Purpose:** Reduce electronic waste, promote recycling, prevent landfill disposal.

**Producer Obligations:**
1. **Registration:** Register with national WEEE authority in each EU country sold
2. **Financing:** Pay for collection, treatment, recycling of WEEE
3. **Reporting:** Report quantities placed on market and recycled
4. **Labeling:** Mark products with crossed-wheelie-bin symbol
5. **Information:** Provide recycling info to consumers

**Collection Targets:**
- 65% of average weight of EEE placed on market over 3 years
- OR 85% of WEEE generated

**Recovery/Recycling Targets:**
| Category | Recovery | Recycling/Reuse |
|----------|----------|-----------------|
| Large appliances | 85% | 80% |
| Small appliances | 75% | 55% |
| IT/Telecom | 85% | 80% |
| Consumer equipment | 85% | 80% |
| Lighting | 85% | 80% |

**WEEE Categories (6):**
1. Temperature exchange equipment
2. Screens, monitors, equipment with screens >100cm²
3. Lamps
4. Large equipment (any external dimension >50cm)
5. Small equipment (no external dimension >50cm)
6. Small IT and telecommunication equipment

**Producer Registration:**
- Unique WEEE registration number per country
- Authorized representative required if no EU establishment
- Annual reporting of placed on market and WEEE handled

---

# EU Food Safety 4
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Food Safety
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**EU Food Contact Materials - Plastics Regulation**

**Scope:** Plastic materials and articles intended to come into contact with food.

**Key Requirements:**
1. **Union List (Annex I):** Only authorized substances may be used
   - Currently 1000+ authorized substances
   - Includes monomers, additives, polymer production aids
   - Each has specific restrictions (SML, QM, QMA)

2. **Specific Migration Limits (SML):**
   - Maximum amount allowed to migrate into food
   - Measured in mg/kg food or mg/dm²
   - Example: BPA SML = 0.05 mg/kg

3. **Overall Migration Limit (OML):**
   - Maximum 60 mg/kg food or 10 mg/dm²
   - Total of all substances migrating

4. **Declaration of Compliance (DoC):**
   - Must accompany products at marketing stages
   - Specifies authorized uses, temperature, food types
   - Migration test results

**Testing Requirements:**
- Overall migration (OML)
- Specific migration (SML) for restricted substances
- Heavy metals (Ba, Co, Cu, Fe, Li, Mn, Zn)
- Primary aromatic amines (PAA)
- Volatile substances

**Dual-Use Additives:**
- Must comply with both food contact and food additive regulations
- Example: Certain antioxidants, colorants

**Bisphenol A (BPA) Restrictions:**
- SML: 0.05 mg/kg
- Prohibited in baby bottles
- New restrictions effective 2025 for other products

---

# US California 5
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: US California
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**California Proposition 65**

**Purpose:** Warn consumers about significant exposure to chemicals causing cancer, birth defects, or reproductive harm.

**Key Requirements:**
1. **Warning Requirements:** Clear and reasonable warnings before exposure
   - New regulations (2018) require specific warning format
   - Must identify at least one chemical by name

2. **Safe Harbor Warnings:**
   - Standard format provides "safe harbor" from enforcement
   - Required elements: ⚠️ symbol, "WARNING", chemical name, exposure risk
   - Example: "WARNING: This product can expose you to [chemical], which is known to the State of California to cause cancer."

**Chemical List:**
- 900+ chemicals listed (updated at least annually)
- No de minimis level (any exposure requires warning unless exempt)
- Two categories: Cancer, Reproductive Toxicity

**Exposure Limits (NSRLs and MADLs):**
- **NSRL (No Significant Risk Level):** For cancer chemicals
  - Maximum daily intake posing no significant risk (1 in 100,000)
- **MADL (Maximum Allowable Dose Level):** For reproductive toxicants
  - No observable effect level divided by 1,000

**Common Listed Chemicals:**
- Lead and lead compounds
- Phthalates (DEHP, DBP, BBP, DIDP, DINP)
- Bisphenol A (BPA)
- Acrylamide
- Cadmium
- Formaldehyde
- Wood dust

**Enforcement:**
- Private attorney general actions (bounty hunters)
- Penalties: Up to $2,500 per violation per day
- 60-day notice of violation before lawsuit
- Settlements often include reformulation

**Exemptions:**
- Naturally occurring chemicals in food
- Businesses with <10 employees
- Government agencies
- Exposures below NSRL/MADL

**Compliance Strategies:**
1. Warning labels on products
2. Point-of-sale warnings
3. Website warnings
4. Product reformulation to eliminate listed chemicals
5. Exposure assessment to demonstrate below safe harbor levels

---

# US Federal 6
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: US Federal
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**TSCA (Toxic Substances Control Act)**

**Administered by:** EPA (Environmental Protection Agency)

**Scope:** All chemical substances manufactured, imported, or processed in the US (excluding pesticides, food, drugs, cosmetics).

**Key Provisions:**

**1. TSCA Section 5 - New Chemicals:**
- Pre-manufacture notification (PMN) required 90 days before production
- Significant New Use Rules (SNURs) for existing chemicals
- EPA can restrict or prohibit manufacture

**2. TSCA Section 6 - Existing Chemicals:**
- EPA can ban or restrict chemicals posing unreasonable risk
- Recent focus on PBT chemicals (persistent, bioaccumulative, toxic)

**3. TSCA Section 8 - Reporting:**
- Chemical Data Reporting (CDR) every 4 years
- Required if manufacture/import ≥ 25,000 lbs/year
- Lower threshold (2,500 lbs) for certain chemicals

**4. TSCA Section 8(b) - Inventory:**
- Active vs. inactive substance designation
- "Reset" completed in 2019
- New chemicals added after PMN approval

**5 TSCA Section 8(e) - Substantial Risk Reporting:**
- Must report within 30 days if new information suggests substantial risk
- Applies to manufacturers, processors, distributors

**Priority Chemicals Under Review:**
- Asbestos
- 1,4-Dioxane
- HBCD (Hexabromocyclododecane)
- Phthalates
- PFAS (Per- and polyfluoroalkyl substances)

**PFAS Specific Requirements:**
- Reporting for PFAS manufactured since 2011
- Significant reporting burden (2024 deadline)
- Includes article importers

**Penalties:**
- Civil: Up to $50,000 per violation per day
- Criminal: Up to $250,000 fine and/or 1 year imprisonment
- Administrative orders for compliance

---

# US Food Safety 7
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: US Food Safety
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**FDA Food Contact Substance (FCS) Regulations**

**Legal Authority:** FD&C Act, 21 CFR Parts 170-189

**Regulatory Framework:**
1. **Food Additive Regulations (21 CFR 170-189):** Direct (Part 172) and indirect additives (Parts 174-178)
2. **Food Contact Notifications (FCN):** Premarket notification, effective 120 days unless FDA objects
3. **GRAS:** Self-determination or FDA notification
4. **TOR Exemption:** For dietary concentration ≤ 0.5 ppb

**Key Substance Categories:**
- **Polymers (21 CFR 177):** Polyethylene (177.1520), Polycarbonate (177.1580), Polystyrene (177.1640)
- **Adhesives (21 CFR 175.105):** Permitted substances with migration limits
- **Paper/Paperboard (21 CFR 176):** Components and defoamers
- **Colorants (21 CFR 178.3297):** For polymers

**Conditions of Use:**
| Temperature | Range | Example |
|-------------|-------|---------|
| Freezer | ≤ -10°C | Frozen food packaging |
| Refrigerated | ≤ 10°C | Dairy containers |
| Room temp | ≤ 40°C | Dry goods |
| Hot fill | 66-100°C | Coffee cups |
| Retort | > 100°C | Canned foods |
| Cooking | > 121°C | Ovenware |

**Food Types & Simulants:**
| Type | Description | Simulant |
|------|-------------|----------|
| I | Non-acid, aqueous | 10% ethanol |
| II | Acidic, aqueous | 3% acetic acid |
| III-IV | Alcoholic | 10-50% ethanol |
| V | Fatty | n-heptane or oil |
| VI-IX | Dry foods | MPPO (Tenax) |

**Chemicals of Concern:**
- **BPA:** Banned in baby bottles/sippy cups
- **PFAS:** Phasing out long-chain PFAS
- **Phthalates:** Limited use (DEHP, DBP, BBP)
- **Heavy metals:** Strict limits

**Recycled Plastics (21 CFR 177.1630):**
- Letter of Non-Objection (LNO) required from FDA
- Challenge testing for contaminant removal
- Source control requirements

**Compliance Documentation:**
- Declaration of Compliance (DoC)
- Letters of guaranty
- Migration testing reports
- Regulatory status documents

---

# China Chemicals 8
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: China Chemicals
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**China REACH - Regulation on Environmental Management of New Chemical Substances**

**Scope:** New chemical substances manufactured or imported into China.

**Key Requirements:**

**1. IECSC (Inventory of Existing Chemical Substances in China):**
- Check if substance is listed (~45,000 substances)
- Listed = Existing chemical (no registration)
- Not listed = New chemical (registration required)

**2. Registration Types:**

**Standard Registration:**
- ≥ 1 tonne/year
- Data requirements based on tonnage band
- Chinese testing required for higher tonnages
- Processing time: 6-12 months

**Simplified Registration:**
- Research and development
- Process development
- Specific low-volume uses
- Lower data requirements

**3. Data Requirements (Standard):**
- Physicochemical properties
- Toxicological data (acute, sub-chronic, chronic)
- Ecotoxicological data
- Environmental fate
- Testing must follow Chinese standards (GB)

**4. Registration Certificate:**
- Valid for 5 years
- Can apply for extension
- Includes approved uses and volume limits

**5. Reporting Obligations:**
- Annual activity report
- Post-registration data if new hazard info emerges

**Penalties:**
- Fines: CNY 200,000 - 1,000,000
- Business suspension
- Criminal liability for serious cases

**Comparison to EU REACH:**
- Similar concept but separate system
- No pre-registration phase
- Different data requirements
- Different inventory
- Separate registration for each legal entity

---

# South Korea Chemicals 9
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: South Korea Chemicals
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**K-REACH - Korea REACH**

**Scope:** New chemical substances and existing substances ≥ 1 tonne/year.

**Key Components:**

**1. Registration:**
- **Existing Chemicals:** (KECI listed ~43,000 substances)
  - Pre-registration (2019 deadline passed)
  - Joint registration for priority substances
- **New Chemicals:**
  - Registration required before manufacture/import
  - Standard or simplified based on tonnage

**2. Registration Tonnage Bands:**
| Tonnage | Data Requirements |
|---------|-------------------|
| 0.1-1 t/y | Simplified |
| 1-10 t/y | Basic set |
| 10-100 t/y | Extended set |
| 100-1000 t/y | Full set |
| 1000+ t/y | Full set + CSR |

**3. CMR Substances:**
- Carcinogenic, Mutagenic, Reprotoxic substances
- Strict reporting and management
- Priority for risk assessment

**4. Product and Process Oriented Research (PPORD):**
- Exemption for R&D
- Volume limited to 1 tonne/year
- Must report to MOE

**5. Polymers:**
- Monomers and additives ≥ 2% must be registered
- Polymer of Low Concern (PLC) criteria available

**6. Only Representative (OR):**
- Non-Korean companies can appoint OR
- OR assumes importer obligations
- Must be based in Korea

**Penalties:**
- Fines: KRW 100 million (~$75,000)
- Imprisonment: Up to 7 years
- Business suspension possible

---

# Japan Chemicals 10
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: Japan Chemicals
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Japan CSCL - Chemical Substances Control Law**

**Scope:** All industrial chemicals manufactured or imported in Japan.

**Regulatory Categories:**

**1. Existing Chemical Substances (ENCS):**
- ~21,000 substances listed
- No notification required
- Listed in two parts (Part 1 and Part 2)

**2. New Chemical Substances:**
- Pre-market notification required to METI
- Small quantity or polymer exemptions available
- Review period: ~3 months

**3. Class I Specified Chemical Substances:**
- Persistent, bioaccumulative, long-term toxicity
- Strict production/import permission system
- Examples: PCBs, DDT, aldrin

**4. Class II Specified Chemical Substances:**
- Persistence and bioaccumulation concerns
- Notification and labeling required
- Examples: Chlordecone, HCB

**5. Monitoring Chemical Substances:**
- Suspected hazards but insufficient data
- Annual reporting of quantities
- ~30 substances currently listed

**Notification Requirements:**
- New chemical notification
- Annual quantity reporting
- Change in use notification
- Hazard data updates

**Testing Requirements:**
- Biodegradation (OECD 301)
- Bioaccumulation (fish)
- Long-term toxicity
- Must use GLP (Good Laboratory Practice)

**Polymer Exemption:**
- Number average MW ≥ 10,000
- Low MW content < 1%
- Not reactive functional groups
- No CMR components ≥ 1%

---

# Australia Chemicals 11
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: Australia Chemicals
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**AICIS - Australian Industrial Chemicals Introduction Scheme**

**Replaced:** NICNAS (National Industrial Chemicals Notification and Assessment Scheme) as of July 1, 2020.

**Scope:** Industrial chemicals imported or manufactured in Australia.

**Introduction Categories:**

**1. Listed:**
- Chemical on Australian Inventory of Chemical Substances (AICS)
- ~40,000 substances
- No pre-introduction reporting
- Must be introduced at or below listed volume

**2. Exempted:**
- Very low risk
- Annual reporting only
- Examples: Polymers of low concern, R&D ≤ 100kg/year

**3. Reported:**
- Low risk but not exempted
- Pre-introduction report required
- Examples: Low volume introductions (≤ 1 t/y)

**4. Assessed:**
- Higher risk chemicals
- Full assessment certificate required
- 30-60 day assessment period
- Certificates valid for 5 years

**Categorization Criteria:**
- Human health hazard characteristics
- Environment hazard characteristics
- Exposure potential
- Introduction volume

**AICS Confidential Inventory:**
- Confidential listing possible
- Generic chemical name published
- Searchable by introducers

**Obligations:**
- Annual declaration by registered introducers
- Record keeping (5 years)
- Compliance with terms of introduction
- Secondary notification if new hazard info emerges

**Penalties:**
- Civil penalties: AUD 333,000 (individual), AUD 1.665 million (corporation)
- Criminal penalties for serious breaches

---

# Global Plastics 12
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: Global Plastics
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Bisphenol A (BPA) Global Regulations**

**What is BPA?**
- Chemical used to make polycarbonate plastics and epoxy resins
- Concerns about endocrine disruption
- Migration from packaging into food

**EU Restrictions:**
- **Food Contact:** SML = 0.05 mg/kg (10/2011)
- **Baby Bottles:** Prohibited since 2011
- **Sippy Cups:** Prohibited
- **Other Products:** Under review for additional restrictions (2025)
- **Thermal Paper:** Prohibited since 2020

**US Restrictions:**
- **FDA:** Banned in baby bottles and sippy cups (2012)
- **State Laws:**
  - California: Prop 65 warning required
  - New York, Washington, Vermont: Various restrictions
  - Connecticut: Ban in reusable food/beverage containers
- **FDA continues to study** safety in other applications

**Canada:**
- Listed as toxic substance under CEPA
- Prohibited in baby bottles
- BPA-free alternatives encouraged

**China:**
- Prohibited in infant food containers
- Migration limits for other uses
- GB standards specify testing methods

**Japan:**
- Voluntary industry reduction
- No strict bans but monitoring
- Consumer preference for BPA-free

**Alternatives to BPA:**
- BPS (Bisphenol S) - similar concerns emerging
- BPF (Bisphenol F) - similar concerns
- Tritan™ copolyester
- Glass, stainless steel
- Plant-based alternatives

**Testing Methods:**
- EU: EN 13130 series
- US FDA: Guidance for industry
- Migration testing with food simulants
- LC-MS/MS detection

**Labeling:**
- "BPA-Free" claims must be truthful
- EU prohibits misleading BPA-free claims for baby bottles
- Some jurisdictions require warnings instead of "free" claims

---

# Global Plastics 13
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: Global Plastics
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Phthalate Regulations Global Overview**

**Common Phthalates and Uses:**
- **DEHP:** PVC plasticizer (being phased out)
- **DBP:** Adhesives, inks, PVC
- **BBP:** Vinyl flooring, adhesives
- **DINP:** PVC, toys (replacing DEHP)
- **DIDP:** Wire/cable, automotive
- **DNOP:** Food wrap, medical tubing

**EU Restrictions:**

**REACH Annex XVII:**
- Toys/Childcare: DEHP, DBP, BBP prohibited
- Toys that can be placed in mouth: DINP, DIDP, DNOP prohibited
- Limit: 0.1% in plasticized material

**RoHS:**
- DEHP, BBP, DBP, DIBP restricted in electronics (0.1%)

**REACH SVHC:**
- DEHP, DBP, BBP, DIBP, DCHP as SVHCs
- Communication required if > 0.1%

**US Restrictions:**

**CPSC:**
- Children's toys: DEHP, DBP, BBP prohibited (permanent ban)
- Children's toys: DINP prohibited (interim)
- Limit: 0.1%

**California Prop 65:**
- DEHP, DBP, BBP, DIDP, DINP listed
- Warnings required for significant exposure

**State Laws:**
- Vermont, Washington: Children's product reporting
- Multiple states considering bans

**Other Regions:**

**Canada:**
- DEHP in toys prohibited
- Proposed restrictions on other phthalates

**China:**
- GB 6675: DEHP, DBP, BBP prohibited in toys (0.1%)
- GB standards for food contact

**Japan:**
- voluntary standards for toys

**Alternatives:**
- DINCH (BASF)
- DEHT/DOTP (Eastman)
- Bio-based plasticizers
- Citrate esters
- Polymeric plasticizers

**Testing:**
- CPSC-CH-C1001-09 (US)
- EN 71-9 (EU toys)
- GC-MS analysis
- Sample preparation critical

---

# Global Plastics 14
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: Global Plastics
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Heavy Metals Restrictions in Plastics and Products**

**Lead (Pb):**

**EU:**
- REACH Annex XVII: 0.05% in jewelry
- RoHS: 0.1% in electronics
- Packaging: 100 ppm total (94/62/EC)
- Paint: 0.009% (toys)

**US:**
- CPSIA: 100 ppm in children's products (accessible parts)
- 90 ppm in paint
- California: Prop 65 warning for lead

**Cadmium (Cd):**

**EU:**
- REACH Annex XVII: Prohibited in jewelry, plastics, paints
- RoHS: 0.01% (100 ppm) in electronics
- Packaging: 100 ppm total

**US:**
- CPSIA: 75 ppm in paint (children's products)
- CPSC guidance for cadmium in jewelry
- Illinois, Minnesota: State-specific restrictions

**Mercury (Hg):**
- RoHS: 0.1% in electronics
- Batteries: restricted (98/101/EC)
- Thermometers: phasing out

**Hexavalent Chromium (CrVI):**
- RoHS: 0.1% in electronics
- REACH: Restricted in various applications
- Leather: 3 ppm limit

**Testing Methods:**
- XRF (screening)
- ICP-OES or ICP-MS (confirmation)
- Sample digestion required
- CPSC-CH-E1001-08.3 (US toys)

**Packaging Heavy Metals (EU 94/62/EC):**
- Sum of Pb, Cd, Hg, Cr(VI) ≤ 100 ppm
- Essential for all packaging in EU
- Certificate of compliance recommended

**Conflict Minerals (US Dodd-Frank):**
- 3TG: Tin, Tantalum, Tungsten, Gold
- Reporting required for SEC-registered companies
- Due diligence on supply chain
- No prohibition, just disclosure

**Emerging Concerns:**
- Arsenic in wood, glass
- Antimony as catalyst residue (PET)
- Cobalt in pigments
- Nickel in plastics (allergen)

---

# EU POPS 15
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU POPS
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**EU POPS Regulation - Persistent Organic Pollutants**

**Legal Basis:** Stockholm Convention and Aarhus Protocol - regulates substances that persist in environment, bioaccumulate, and pose long-term risks.

**Key Substances and Restrictions:**

**1. PFOS (Perfluorooctane sulfonic acid) and derivatives:**
- **Limit:** 10 mg/kg (0.001%) in substances/mixtures
- **Articles:** 0.1% by weight (textiles, coatings)
- **Semi-finished products:** 1 μg/m² for textiles
- **Uses restricted:** Chrome plating, hydraulic fluids, photoresists, firefighting foam

**2. PFOA (Perfluorooctanoic acid) and salts:**
- **Limit:** 25 ppb for PFOA; 1000 ppb for PFOA-related substances
- **Effective:** July 4, 2020 (main restriction)
- **Exemptions:** Protective clothing for firefighters, medical textiles

**3. SCCPs (Short Chain Chlorinated Paraffins - C10-C13):**
- **Limit:** 1% in substances/mixtures
- **Articles:** 0.15% by weight

**4. HBCDD (Hexabromocyclododecane):**
- **Limit:** 100 mg/kg in substances/mixtures/articles
- **Recycled polystyrene exemption until 2036**

**5. Other Restricted POPS:** PCBs, DDT, Chlordane, Dieldrin, Endrin, Heptachlor, Toxaphene, Mirex, HCB

**Compliance Actions:** Screen supply chain, test products, obtain declarations

**Testing Methods:** LC-MS/MS for PFAS, GC-MS for SCCPs, LC-MS/MS for HBCDD

---

# EU Medical Devices 16
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Medical Devices
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**EU MDR - Medical Device Regulation (2017/745)**

**Scope:** All medical devices placed on EU market (Class I, IIa, IIb, III).

**Device Classification:**
| Class | Risk | Examples | Route |
|-------|------|----------|-------|
| I | Low | Bandages, gloves | Self-cert |
| IIa | Medium | Hearing aids | Notified Body |
| IIb | Higher | Infusion pumps | Notified Body |
| III | High | Heart valves | Notified Body |

**Key Requirements:**
- **UDI:** Unique Device Identification mandatory
- **EUDAMED:** Device registration in EU database
- **Technical Documentation:** Including clinical evidence
- **Quality Management:** EN ISO 13485 required

**Transition Timeline:**
- Class III/IIb active: Dec 31, 2027
- Class IIa/I: Dec 31, 2028

**Penalties:** Up to €10 million or 4% annual turnover

---

# EU REACH Authorization 17
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU REACH Authorization
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**REACH Annex XIV - Substances Subject to Authorization**

**Key Terms:**
- **Sunset Date:** After this, use prohibited without authorization
- **Latest Application Date:** Deadline for submitting application

**Current Substances (Selected):**
| Substance | Sunset Date | CAS |
|-----------|-------------|-----|
| DEHP | 2015-02-21 | 117-81-7 |
| DBP | 2015-02-21 | 84-74-2 |
| BBP | 2015-02-21 | 85-68-7 |
| DIBP | 2020-02-21 | 84-69-5 |
| Chromium trioxide | 2017-09-21 | 1333-82-0 |

**Authorization Justification:** Substitution plan, socio-economic analysis, alternatives analysis

**Compliance Actions:** Screen supply chain, check sunset dates, plan substitution or authorization

---

# EU REACH Restrictions 18
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU REACH Restrictions
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**REACH Annex XVII - Restrictions on Dangerous Substances**

**70+ entries covering 1000+ substances**

**Common Restrictions:**

**1. CMR Substances:**
- Entry 28-30: Prohibited in consumer products
- Entry 72: 33 CMRs restricted in clothing/textiles

**2. Phthalates:**
- Entry 51: DEHP, DBP, BBP ≤ 0.1% in toys
- Entry 52: DINP, DIDP, DNOP ≤ 0.1% in mouthable toys

**3. Heavy Metals:**
- Entry 63: Lead ≤ 0.05% in jewelry
- Entry 23: Cadmium ≤ 0.01% in plastics

**4. PFAS:**
- Entry 68: PFOA ≤ 25 ppb

**5. Recent Additions:**
- Microplastics: Intentionally added prohibited
- Formaldehyde: 0.062 mg/m³ emission limit (Entry 77)
- Dioxane: ≤ 10 mg/kg in cosmetics (Entry 76)

---

# US Federal 19
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: US Federal
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**TSCA Section 6 - Existing Chemical Risk Management**

**Current Restrictions:**

**1. PCE (Perchloroethylene):**
- Prohibited in most consumer products
- Workplace restrictions for dry cleaning

**2. TCE (Trichloroethylene):**
- Prohibited: Aerosol/vapor degreasing
- Allowed: Some aerospace/military with controls

**3. Methylene Chloride:**
- Prohibited in consumer paint strippers (2019)
- Industrial use with strict controls

**4. HBCDD:**
- Prohibited with recycling exemption until 2026

**PBT Chemicals - Section 6(h):**
- 2,4,6-TTBP: ≤ 0.3% in containers
- DecaBDE: Phased out
- PIP (3:1): Extended phase-out timeline

**Penalties:** Up to $50,000 per violation per day

---

# US Federal 20
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: US Federal
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**PFAS (Per- and Polyfluoroalkyl Substances) - "Forever Chemicals"**

**Federal Regulations:**

**1. TSCA Section 8(a)(7) Reporting:**
- Manufacturers/importers of PFAS since 2011 must report
- Extensive data on use, volumes, disposal

**2. EPA Drinking Water Standards (2024):**
- PFOA: 4 ppt
- PFOS: 4 ppt
- PFHxS, PFNA, GenX: 10 ppt each

**3. EPA CERCLA Designation (2024):**
- PFOA and PFOS designated hazardous substances
- Superfund liability for releases

**State Regulations:**
- **Maine:** All products PFAS-free by 2030
- **California:** Prop 65 listings, disclosure requirements
- **Washington, New York, Vermont:** Food packaging bans

**Testing:** Targeted LC-MS/MS, Total Organic Fluorine (50 ppm threshold)

---

# California ESG 21
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: California ESG
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**CA SB-253 - Climate Corporate Data Accountability Act**

**Effective:** January 1, 2026 (first reporting 2027)

**Scope:** US entities with >$1 billion revenue doing business in CA

**Requirements:**

**Scope 1 & 2 GHG Emissions:**
- Report 2026 data by 2027
- GHG Protocol Corporate Standard
- Limited assurance initially → reasonable by 2030
- Third-party verification required

**Scope 3 GHG Emissions (Value Chain):**
- Report by 2027
- All indirect emissions (suppliers, transport, use, disposal)
- Exemption if Scope 3 < 40% of total

**Penalties:** Up to $500,000 per reporting year

**Supplier Implications:** Large suppliers must provide GHG data to customers

---

# California ESG 22
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: California ESG
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**CA SB-261 - Climate-Related Financial Risk Act**

**Effective:** January 1, 2026 (biennial reports)

**Scope:** US entities with >$500 million revenue doing business in CA

**Required Disclosures (TCFD-aligned):**

**Governance:**
- Board oversight of climate risks
- Management role in risk assessment

**Strategy:**
- Climate risks and opportunities
- Impact on business strategy
- Scenario analysis

**Risk Management:**
- Process for identifying risks
- Integration into overall risk management

**Metrics and Targets:**
- GHG emissions metrics
- Climate-related targets and progress

**Penalties:** Up to $50,000 per violation

**Overlap with SB-253:** Companies >$1B must comply with BOTH laws

---

# Electronics Standards 23
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: Electronics Standards
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Halogen-Free Standards for Electronics**

**Purpose:** Reduce environmental impact by eliminating halogenated flame retardants.

**Key Standards:**

**IEC 61249-2-21:**
- Chlorine (Cl): ≤ 900 ppm (0.09%)
- Bromine (Br): ≤ 900 ppm (0.09%)
- Total halogens (Cl + Br): ≤ 1500 ppm (0.15%)

**JPCA-ES-01-2003:**
- Similar limits (Japan-specific)
- Often cited together with IEC standard

**Why Halogen-Free:**
- Dioxins/furans during incineration
- Toxic smoke in fires
- Environmental persistence

**Testing:** EN 14582 (oxygen combustion + ion chromatography)

**Alternatives:**
- Phosphorus-based flame retardants
- Nitrogen-based (melamine derivatives)
- Inorganic (aluminum hydroxide, magnesium hydroxide)

**Industries:** Consumer electronics, automotive, aerospace, medical devices

---

# UK Chemicals 24
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: UK Chemicals
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**UK REACH (Registration, Evaluation, Authorization and Restriction of Chemicals)**

**Post-Brexit Status:**
UK REACH replaced EU REACH in Great Britain (England, Scotland, Wales) on January 1, 2021. Northern Ireland continues under EU REACH.

**Key Differences from EU REACH:**

**1. Registration:**
- New GB-based registrations required for existing substances
- Grandfathering period for EU registrations held by GB entities
- DUIN (Downstream User Import Notification) deadline: October 27, 2023 (CLOSED)

**2. Data Requirements:**
- Can use EU REACH data (with permission)
- Reduced data submission initially (light-touch approach)
- Full data required within specified timeframes

**3. SVHC (Substances of Very High Concern):**
- UK SVHC list mirrors EU initially
- UK can add substances independently
- Current: Subset of EU SVHC list (approximately 28 substances vs 235+)

**4. Authorization:**
- UK Authorization List mirrors EU Annex XIV
- Sunset dates may differ
- GB-based authorization required for continued use

**5. Only Representative (OR):**
- Must be established in Great Britain
- Cannot use EU-based OR for GB market

**6. Agency:**
- HSE (Health and Safety Executive) instead of ECHA
- UK Agency responsible for evaluations

**Compliance Deadlines:**
- **October 27, 2023:** DUIN deadline (for existing EU REACH registrations)
- **October 27, 2026:** Full registration data submission deadline (for grandfathered registrations)

**Penalties:**
- Unlimited fines (determined by courts)
- Up to 2 years imprisonment for serious violations
- Market access denial

**GB vs Northern Ireland:**
| Region | REACH Regulation | Customs |
|--------|------------------|---------|
| Great Britain | UK REACH | UK customs |
| Northern Ireland | EU REACH | EU customs (NI Protocol) |

**Practical Implications:**
- Dual registrations needed for EU + GB markets
- Separate supply chain management
- Increased compliance costs (estimated 20-40% increase)
- Potential divergence over time

---

# EU Climate 25
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Climate
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**EU CBAM - Carbon Border Adjustment Mechanism**

**Purpose:** Prevent carbon leakage by equalizing carbon price between EU imports and domestic production.

**Timeline:**
- **October 2023 - December 2025:** Transitional phase (reporting only)
- **January 2026:** Full implementation (purchase of CBAM certificates required)

**Covered Products (Initial):**
| Sector | HS Codes | Embedded Emissions |
|--------|----------|-------------------|
| Cement | 2507, 2523, 6810 | Direct + indirect |
| Iron & Steel | 7201-7229, 7301-7308 | Direct + indirect |
| Aluminum | 7601-7606, 7610 | Direct + indirect |
| Fertilizers | 2808, 3102, 3105 | Direct + indirect |
| Electricity | 2716 | Direct |
| Hydrogen | 2804 | Direct |

**Expansion Planned:**
- Organic chemicals
- Plastics
- Other sectors by 2030

**Reporting Requirements (Transitional Phase):**
- Quarterly reports via CBAM Transitional Registry
- Embedded emissions data (direct + indirect)
- Carbon price paid in country of origin
- Actual emissions or default values

**CBAM Certificates (From 2026):**
- Purchase from national authorities
- Price linked to EU ETS allowance price
- Surrender certificates equal to embedded emissions
- No free allocation (unlike EU ETS)

**Calculation Methodology:**
- **Direct emissions:** Process emissions (Scope 1)
- **Indirect emissions:** Electricity consumed (Scope 2)
- Based on actual data or EU default values
- Must use EU methodology (monitoring & reporting)

**Importer Obligations:**
1. Register as CBAM declarant
2. Calculate/purchase CBAM certificates
3. Submit annual CBAM declaration
4. Keep records for 4 years

**Exemptions:**
- Value < €150 per shipment
- Countries with linked ETS (none currently, UK being considered)
- Military goods

**Penalties:**
- €10-50 per tonne of unreported emissions
- Market access denial for non-compliance
- Criminal sanctions for fraud

**Preparation Checklist:**
☐ Identify if products fall under CBAM
☐ Establish emissions monitoring system
☐ Engage suppliers for upstream emissions data
☐ Register for CBAM Transitional Registry
☐ Prepare quarterly reports
☐ Budget for CBAM certificate purchases (2026+)

---

# EU Circular Economy 26
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Circular Economy
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Digital Product Passport (DPP)**

**Legal Basis:** Ecodesign for Sustainable Products Regulation (ESPR)

**Purpose:** Provide product sustainability information throughout value chain via digital access (QR code/data carrier).

**Timeline:**
- **2024:** ESPR entered into force
- **2027:** First DPPs required (batteries)
- **2030:** Full implementation across priority products

**Key Requirements:**

**1. Data Carrier:**
- QR code or other machine-readable identifier
- Linked to unique product identifier
- Must remain accessible throughout product lifetime

**2. Information to Include:**
| Category | Data Elements |
|----------|---------------|
| Identification | Product ID, manufacturer, model |
| Compliance | Certificates, test reports |
| Sustainability | Environmental footprint, recycled content |
| Circularity | Repair instructions, disassembly info |
| Materials | Substances of concern, material composition |
| Traceability | Supply chain information |

**Priority Product Categories (First Wave):**
1. **Batteries** (first, by 2027)
2. Textiles
3. Construction products
4. Electronics/ICT
5. Furniture
6. Plastics
7. Chemicals
8. Steel

**Battery Passport (First Implementation):**
- Most detailed DPP requirements
- Carbon footprint declaration
- Recycled content information
- Due diligence data
- Performance/durability metrics
- Safety information

**Technical Standards:**
- Interoperability required across systems
- Open standards (not proprietary)
- Data governance frameworks
- Access control (public vs restricted data)

**Access Levels:**
| Stakeholder | Access |
|-------------|--------|
| Consumers | Basic sustainability info |
| Value chain actors | Detailed technical data |
| Authorities | Full compliance data |
| Repair shops | Repair/disassembly info |

**Compliance:**
- Manufacturers responsible for data accuracy
- Regular updates required
- Third-party verification for some data
- Penalties under national laws

**Business Preparation:**
- Assess if products in priority categories
- Evaluate data collection systems
- Engage IT vendors for DPP platforms
- Coordinate with suppliers for upstream data
- Plan QR code integration into products

---

# EU Circular Economy 27
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Circular Economy
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Extended Producer Responsibility (EPR) Framework**

**Definition:** Producers (manufacturers, importers, brand owners) are financially and operationally responsible for product end-of-life management.

**EU Legal Basis:**
- Waste Framework Directive (2008/98/EC)
- Packaging and Packaging Waste Directive
- WEEE Directive
- Battery Directive
- Single-Use Plastics Directive

**Covered Product Categories:**

| Category | Scope | Fees Based On |
|----------|-------|---------------|
| **Packaging** | All packaging placed on market | Material type, weight, recyclability |
| **WEEE** | Electrical/electronic equipment | Category, weight, collection costs |
| **Batteries** | All battery types | Chemistry, weight |
| **Textiles** | Clothing, footwear (new 2025) | Weight, fiber composition |
| **Furniture** | All furniture (new) | Weight, material |
| **Tyres** | Vehicle and industrial | Type, weight |
| **Oils** | Lubricating and industrial | Volume |
| **Agricultural plastics** | Films, containers, nets | Weight |

**Producer Obligations:**

**1. Registration:**
- Register with national EPR scheme in each EU country
- Obtain producer registration number
- Report placed-on-market quantities

**2. Financial Contribution:**
- Pay EPR fees (modulated by recyclability)
- Finance collection, sorting, recycling
- Advance disposal fees for some products

**3. Collection Targets:**
| Category | Target |
|----------|--------|
| Packaging | 65% recycling by 2025 |
| WEEE | 65% collection rate |
| Batteries | 45% collection rate |
| Textiles | Separate collection by 2025 |

**4. Reporting:**
- Annual reporting of quantities placed on market
- Monthly/quarterly fee payments
- Traceability documentation

**New EU Battery Regulation (2023):**
- Extended EPR for all battery types
- Collection targets:
  - Portable: 45% (2023) → 73% (2030)
  - LMT (Light Means of Transport): 51% (2028) → 61% (2031)
  - Industrial/EV: Mandate but no specific targets yet
- Recycling efficiency targets:
  - Lead-acid: 75%
  - Lithium: 65%
  - Nickel-cadmium: 80%

**Packaging EPR - New Rules (2024+):**
- Extended to e-commerce (marketplaces)
- Design for recycling requirements
- Recycled content targets:
  - 35% by 2030
  - 65% by 2040
- Deposit return schemes for beverage containers

**Penalties:**
- Fines (vary by country: €500-€100,000+)
- Market access denial
- Criminal liability for fraud
- Public procurement exclusion

**Compliance Strategy:**
1. Identify all applicable EPR categories
2. Register in each EU member state sold
3. Calculate and budget EPR fees
4. Implement eco-design for recyclability
5. Consider compliance schemes (PROs)

---

# EU Marketing 28
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: EU Marketing
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**EU Green Claims Directive (Anti-Greenwashing)**

**Status:** Adopted 2024, member state implementation by 2026

**Purpose:** Combat greenwashing by ensuring environmental claims are substantiated, comparable, and verifiable.

**Scope:** All voluntary environmental claims made by businesses about products or organizations.

**Prohibited Claims:**

**1. Vague/General Claims (without proof):**
- ❌ "Eco-friendly"
- ❌ "Green"
- ❌ "Environmentally friendly"
- ❌ "Natural"
- ❌ "Biodegradable" (without conditions)
- ❌ "Climate neutral" (without explanation)

**2. Misleading Claims:**
- ❌ Presenting legal compliance as exceptional
- ❌ Cherry-picking favorable environmental aspects
- ❌ Using false certifications
- ❌ Misleading product comparisons

**Substantiation Requirements:**

**1. Scientific Evidence:**
- Based on recognized scientific methods
- Lifecycle perspective considered
- Representative of product's life cycle
- Takes into account all significant environmental aspects

**2. Primary Evidence:**
- Specific to the product/organization
- Not generic industry data
- Regularly updated

**3. Verification:**
- Claims must be verified by independent third party
- Prior verification required before use
- Regular re-verification (at least every 5 years)

**Specific Rules for Common Claims:**

| Claim | Requirements |
|-------|-------------|
| **Recyclable** | Clear instructions, infrastructure availability |
| **Recycled content** | Specific percentage, post-consumer vs post-industrial |
| **Biodegradable** | Specific conditions, timeframe, environment |
| **Compostable** | Reference to standard (EN 13432), timeframe |
| **Carbon neutral** | Clear scope, offsetting limitations disclosed |
| **Organic** | Certification required, percentage threshold |

**Carbon Neutrality Claims - Special Rules:**
- Must prioritize emissions reductions in value chain
- Offsetting can only claim for residual emissions
- Must disclose:
  - What portion is actual reduction vs offset
  - Offset standards used (Gold Standard, VCS)
  - Vintage and type of credits

**Comparative Claims:**
- Must compare equivalent products/functions
- Same life cycle stages considered
- Current, verifiable data
- Clear what is being compared

**Labeling Requirements:**
- Environmental labels must be transparent
- Only EU-approved or widely recognized schemes
- New public environmental labels require EU approval
- Existing private schemes must meet criteria

**Enforcement:**
- Competent national authorities
- Penalties proportionate to environmental impact
- Possible penalties:
  - Fines (up to 4% of annual revenue for serious cases)
  - Market exclusion
  - Mandatory corrective advertising

**Compliance Checklist:**
☐ Audit all environmental claims
☐ Remove unsubstantiated vague claims
☐ Gather scientific evidence for remaining claims
☐ Engage third-party verification
☐ Update marketing materials
☐ Train marketing/sales teams
☐ Implement claim approval process

---

# China Electronics 29
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: China Electronics
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**China RoHS 2 - Administrative Measures for Restriction of Hazardous Substances**

**Full Title:** Administrative Measures for the Restriction of the Use of Hazardous Substances in Electrical and Electronic Products

**Effective:** July 1, 2016 (replaced original China RoHS)

**Scope:** Electrical and electronic products (EEP) sold in China

**Restricted Substances (Same as EU RoHS):**
| Substance | Limit |
|-----------|-------|
| Lead (Pb) | 0.1% |
| Mercury (Hg) | 0.1% |
| Cadmium (Cd) | 0.01% |
| Hexavalent Chromium (Cr6+) | 0.1% |
| PBB | 0.1% |
| PBDE | 0.1% |

**Key Differences from EU RoHS:**

**1. Two-Step Approach:**

**Step 1 (Current): Marking and Disclosure**
- Mark products with pollution control logo (e-label)
- Table 1 (橙色标志): Contains restricted substances above limits
- Table 2 (绿色标志): Environmentally friendly use period (EFUP) declared
- Required: Material declaration in standardized SJ/T 11364 format

**Step 2 (Implementation Timeline Uncertain):**
- Full restriction of substances (similar to EU)
- Catalog of products subject to mandatory compliance
- CCC certification integration

**2. EFUP (Environmentally Friendly Use Period):**
- Number of years product can safely contain restricted substances
- Marked on product (e.g., "10" for 10 years)
- Different approach from EU RoHS exemptions

**3. Marking (SJ/T 11364-2014):**
- Pollution Control Mark required on product
- Color-coded:
  - **Green logo (e):** EFUP declared, safe for specified period
  - **Orange logo (e):** Contains restricted substances, Table 1 disclosure required
- Marking on product, packaging, and documentation

**4. Material Declaration:**
- Required for all EEP
- Standardized format
- Names and content of restricted substances
- Parts containing restricted substances

**Product Catalog (Step 2):**
When implemented, mandatory compliance applies to:
- Refrigerators
- Washing machines
- Computers
- Printers
- TVs
- Mobile phones
- (Catalog expanded periodically)

**Testing Standards:**
- GB/T 26125 (equivalent to IEC 62321)
- XRF screening accepted
- Chemical confirmation for positive results

**Compliance Requirements:**
1. Determine if product is EEP
2. Test for restricted substances
3. Create material declaration (Table 1 or Table 2)
4. Apply appropriate pollution control mark
5. Prepare supporting documentation

**Penalties:**
- Administrative penalties
- Market withdrawal
- Brand reputation damage
- Note: Less mature enforcement than EU

**Practical Tips:**
- Most manufacturers comply with Step 1 marking
- Step 2 implementation timeline uncertain
- Many treat as de facto EU RoHS compliance
- Market surveillance increasing

---

# India Electronics 30
Source: src/features/comprehensive-chatbot/GlobalComplianceKnowledge.ts
Domain: sixsigma
Category: India Electronics
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**India RoHS - E-Waste (Management) Rules**

**Current Regulation:** E-Waste (Management) Rules, 2022 (amended 2023)

**Legal Basis:** Ministry of Environment, Forest and Climate Change (MoEFCC)

**Scope:** Electrical and electronic equipment (EEE) placed on Indian market

**Restricted Substances (Same 6 as EU RoHS):**
| Substance | Limit (ppm) |
|-----------|-------------|
| Lead (Pb) | 1000 |
| Mercury (Hg) | 1000 |
| Cadmium (Cd) | 100 |
| Hexavalent Chromium (Cr6+) | 1000 |
| PBB | 1000 |
| PBDE | 1000 |

**Compliance Deadlines:**

| Phase | EEE Categories | Effective Date |
|-------|----------------|----------------|
| Phase 1 | Large/Small appliances, IT equipment, Telecom | November 1, 2024 |
| Phase 2 | Consumer electronics, lighting, tools, toys | November 1, 2025 |

**EEE Categories (Schedule I):**
1. Large household appliances
2. Small household appliances
3. IT and telecommunication equipment
4. Consumer equipment
5. Lighting equipment
6. Electrical and electronic tools
7. Toys, leisure, and sports equipment
8. Medical devices (with some exemptions)
9. Monitoring and control instruments
10. Automatic dispensers

**Exemptions:**
- Similar to EU RoHS exemptions
- Renewable every 5 years
- Must apply to Central Pollution Control Board (CPCB)

**Producer Obligations:**

**1. Registration:**
- Register with CPCB/State PCB
- Obtain EPR authorization
- File annual returns

**2. E-Waste Collection:**
- Collection targets based on sales volume
- Set up collection centers
- Take-back programs

**3. Recycling:**
- Meet recycling targets:
  - 2023-24: 60% of quantity sold
  - 2024-25: 70%
  - 2025 onwards: 80%

**4. Compliance Documentation:**
- Technical documents (evidence of compliance)
- Self-declaration of conformity
- Test reports (IEC 62321 series)
- Material safety data sheets

**5. Labeling:**
- Crossed-bin symbol required
- Do not dispose with household waste
- Producer contact information

**Import Requirements:**
- Customs clearance requires compliance documentation
- BIS (Bureau of Indian Standards) marking may be required
- Test reports from recognized labs

**Penalties:**
- Environmental compensation
- Fine up to ₹1,00,000 (approx $1,200 USD)
- Repeat violations: up to ₹5,00,000
- Possible imprisonment up to 5 years for serious violations

**Certification:**
- Third-party testing required
- BIS-recognized labs or international equivalents
- Self-certification allowed with proper documentation

**Comparison with EU RoHS:**
| Aspect | India RoHS | EU RoHS |
|--------|------------|---------|
| Substances | Same 6 | Same 6 + 4 phthalates |
| Enforcement | Developing | Mature |
| Testing | IEC 62321 | IEC 62321 |
| EPR | Yes (combined with e-waste) | Separate WEEE |

**Compliance Tips:**
- Start compliance early (enforcement ramping up)
- Ensure supply chain documentation
- Plan for EPR authorization timeline
- Consider combined EU/India testing
- Monitor CPCB notifications for updates

---

# Conflict Minerals (3TG)
Source: src/features/comprehensive-chatbot/SupplierCompliance.ts
Domain: sixsigma
Category: Supply Chain
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Conflict Minerals Reporting (US Dodd-Frank Act Section 1502)**

**What are Conflict Minerals?**
- **3TG:** Tin (Cassiterite), Tantalum (Coltan), Tungsten (Wolframite), Gold
- Sourced from Democratic Republic of Congo (DRC) and adjoining countries
- May finance armed groups

**Who Must Report?**
- SEC-registered companies
- Manufacture or contract to manufacture products using 3TG
- Must conduct Reasonable Country of Origin Inquiry (RCOI)

**Reporting Requirements:**
1. **Form SD** filed annually with SEC
2. **Conflict Minerals Report (CMR)** if not DRC conflict-free
3. **Due diligence** following OECD Guidance

**OECD 5-Step Framework:**
1. Establish strong company management systems
2. Identify and assess risk in supply chain
3. Design and implement strategy to respond to risks
4. Carry out independent third-party audit
5. Report annually on supply chain due diligence

**Smelter and Refiner Lists:**
- Use RMI (Responsible Minerals Initiative) lists
- Conformant vs. Active smelters
- Check smelter status: www.responsiblemineralsinitiative.org

**CMRT (Conflict Minerals Reporting Template):**
- Industry-standard template for collecting data
- Sent to suppliers to identify smelters
- Must be updated regularly

**EU Conflict Minerals Regulation (2021):**
- Directly applies to EU importers of 3TG
- Due diligence obligations
- More limited scope than US rule

**Penalties (US):**
- SEC enforcement actions
- Reputational damage
- Shareholder lawsuits
- Customer contract issues

---

# Supplier Quality Audits
Source: src/features/comprehensive-chatbot/SupplierCompliance.ts
Domain: sixsigma
Category: Supply Chain
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Supplier Quality Audit Best Practices**

**Audit Types:**
1. **Initial/Qualification Audit** - Before approval
2. **Surveillance Audit** - Regular monitoring (annual)
3. **Special Cause Audit** - After quality issues
4. **Re-qualification Audit** - After significant changes

**Audit Standards:**
- **VDA 6.3** (Process audit - Automotive)
- **ISO 19011** (Audit guidelines)
- **Customer-specific requirements**
- **Industry standards** (AS9100, IATF 16949, etc.)

**Key Audit Areas:**
1. **Quality Management System**
   - Document control
   - Management review
   - Internal audits
   - Corrective actions

2. **Production Process Control**
   - Process validation
   - SPC implementation
   - Control plans
   - Work instructions

3. **Measurement Systems**
   - Calibration system
   - MSA studies
   - Gauge R&R

4. **Supplier Management**
   - Their supplier controls
   - Incoming inspection
   - Sub-tier traceability

5. **Change Management**
   - ECN process
   - Customer notification
   - PPAP for changes

**Audit Scoring:**
- Green (A): 90-100% - Approved
- Yellow (B): 80-89% - Conditional approval with action plan
- Red (C): <80% - Not approved

**Common Findings:**
- Missing SPC on critical dimensions
- Incomplete calibration records
- No PFMEA updates
- Inadequate training records
- Poor house keeping (5S)

---

# Certificate of Compliance (CoC)
Source: src/features/comprehensive-chatbot/SupplierCompliance.ts
Domain: sixsigma
Category: Supply Chain
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Certificate of Compliance Requests**

**What is a CoC?**
Document certifying that product/material meets specified requirements.

**Types of CoC:**
1. **Regulatory CoC** - Meets legal requirements
2. **Specification CoC** - Meets technical specs
3. **Origin CoC** - Country of origin
4. **Conformity CoC** - ISO, industry standards

**Information to Request:**
- Product name/part number
- Specification/revision
- Batch/lot number
- Test results
- Date of manufacture
- Authorized signature
- Company certification

**REACH CoC:**
- Confirmation substance is listed on IECSC or registered
- SVHC content < 0.1%
- Authorization compliance

**RoHS CoC:**
- Confirmation of compliance with restricted substances
- May include test reports

**Prop 65 CoC:**
- Confirmation product doesn't contain listed chemicals above NSRL
- Or warning is provided

**Full Material Declaration (FMD):**
- Detailed breakdown of all substances
- CAS numbers
- Concentration ranges
- Required for high-risk products

**Managing CoCs:**
- Request at PO placement
- Verify authenticity
- Maintain in supplier file
- Update annually
- Version control

**Red Flags:**
- Generic templates without specific data
- Missing signatures
- Outdated test reports
- Refusal to provide
- Suspicious formatting

---

# Supply Chain Risk Management
Source: src/features/comprehensive-chatbot/SupplierCompliance.ts
Domain: sixsigma
Category: Supply Chain
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Supply Chain Risk Management**

**Types of Risks:**
1. **Quality Risks**
   - Supplier defects
   - Inconsistent quality
   - Process drift

2. **Delivery Risks**
   - Capacity constraints
   - Logistics disruptions
   - Lead time variability

3. **Financial Risks**
   - Supplier bankruptcy
   - Currency fluctuation
   - Price volatility

4. **Regulatory Risks**
   - Non-compliance by supplier
   - Trade restrictions
   - Tariffs

5. **Geopolitical Risks**
   - Natural disasters
   - Political instability
   - Pandemics

**Risk Assessment Matrix:**
| Severity | Probability | Risk Level |
|----------|-------------|------------|
| High | High | Critical |
| High | Medium | High |
| Medium | High | High |
| Low | High | Medium |

**Mitigation Strategies:**
1. **Dual Sourcing** - Multiple suppliers for critical items
2. **Safety Stock** - Buffer inventory
3. **Supplier Development** - Improve capabilities
4. **Contracts** - Long-term agreements with penalties
5. **Monitoring** - KPIs and early warning systems
6. **Geographic Diversification** - Spread risk across regions

**Critical Supplier Criteria:**
- Single source
- High dollar value
- Long lead time
- Impact on safety/regulatory
- Difficult to qualify alternatives

**Supplier Scorecard Metrics:**
- Quality (PPM, defects)
- Delivery (OTD, lead time)
- Cost (price competitiveness)
- Service (responsiveness)
- Risk (financial, geographic)

**Business Continuity Planning:**
- Alternative supplier identification
- Qualification in advance
- Emergency response procedures
- Communication protocols

---

# Safety Data Sheet (SDS) - Complete Guide
Source: src/features/comprehensive-chatbot/SDSAndLabeling.ts
Domain: sixsigma
Category: Safety Documentation
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Safety Data Sheet (SDS) - 16 Sections**

**Format:** Globally Harmonized System (GHS) standardized format

**Section 1: Identification**
- Product identifier (name, number)
- Recommended uses
- Supplier contact information
- Emergency phone number

**Section 2: Hazard(s) Identification**
- GHS classification
- Signal word (Danger/Warning)
- Hazard statements
- Precautionary statements
- Pictograms

**Section 3: Composition/Information on Ingredients**
- Chemical identity (CAS numbers)
- Concentration or concentration ranges
- Impurities and stabilizing additives

**Section 4: First-Aid Measures**
- Description of necessary measures
- Most important symptoms/effects
- Indication of immediate medical attention

**Section 5: Fire-Fighting Measures**
- Suitable extinguishing media
- Specific hazards from chemical
- Special protective equipment

**Section 6: Accidental Release Measures**
- Personal precautions
- Environmental precautions
- Methods for containment/cleaning

**Section 7: Handling and Storage**
- Precautions for safe handling
- Conditions for safe storage
- Incompatible materials

**Section 8: Exposure Controls/Personal Protection**
- Control parameters (OELs, PELs)
- Appropriate engineering controls
- Individual protection measures

**Section 9: Physical and Chemical Properties**
- Appearance, odor, pH
- Melting/freezing point
- Boiling point
- Flash point
- Flammability
- Solubility
- Viscosity

**Section 10: Stability and Reactivity**
- Reactivity
- Chemical stability
- Possibility of hazardous reactions
- Conditions to avoid
- Incompatible materials

**Section 11: Toxicological Information**
- Routes of exposure
- Symptoms
- Acute toxicity (LD50/LC50)
- Skin corrosion/irritation
- Serious eye damage/irritation
- Respiratory/skin sensitization
- Germ cell mutagenicity
- Carcinogenicity
- Reproductive toxicity

**Section 12: Ecological Information**
- Toxicity to fish, algae, daphnia
- Persistence and degradability
- Bioaccumulative potential
- Mobility in soil

**Section 13: Disposal Considerations**
- Waste treatment methods
- Contaminated packaging

**Section 14: Transport Information**
- UN number
- Proper shipping name
- Transport hazard class
- Packing group
- Environmental hazards
- Special precautions

**Section 15: Regulatory Information**
- Safety, health and environmental regulations
- Chemical inventory status (TSCA, REACH, etc.)

**Section 16: Other Information**
- Preparation/revision date
- Key abbreviations
- References

**SDS Language Requirements:**
- Must be in official language of country
- US: English (OSHA)
- EU: Language of member state
- Canada: English and French

**SDS Update Frequency:**
- When new significant information available
- Minimum every 3-5 years recommended
- Within 3 months of significant change

**Penalties for Non-Compliance:**
- OSHA fines: Up to $15,625 per violation
- EU: Criminal penalties possible
- Market withdrawal

---

# GHS Labeling Requirements
Source: src/features/comprehensive-chatbot/SDSAndLabeling.ts
Domain: sixsigma
Category: Safety Documentation
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**GHS Label Elements**

**Required Label Elements:**

**1. Product Identifier**
- Name or number matching SDS
- May include chemical name

**2. Supplier Identification**
- Name, address, phone
- Emergency contact number

**3. Hazard Pictograms (9 Total)**

| Symbol | Hazard Class | Pictogram |
|--------|--------------|-----------|
| GHS01 | Explosive | 💥 |
| GHS02 | Flammable | 🔥 |
| GHS03 | Oxidizing | 🟡 |
| GHS04 | Compressed Gas | 🫧 |
| GHS05 | Corrosive | 🧪 |
| GHS06 | Acute Toxicity | ☠️ |
| GHS07 | Harmful/Irritant | ⚠️ |
| GHS08 | Health Hazard | 🫁 |
| GHS09 | Environmental | 🌊 |

**4. Signal Word**
- **DANGER** - More severe hazards
- **WARNING** - Less severe hazards
- Only one per label

**5. Hazard Statements**
- Standardized phrases (H-codes)
- H200-H299: Physical hazards
- H300-H399: Health hazards
- H400-H499: Environmental hazards
- Examples:
  - H225: Highly flammable liquid and vapor
  - H314: Causes severe skin burns and eye damage
  - H330: Fatal if inhaled
  - H360: May damage fertility or unborn child

**6. Precautionary Statements**
- Prevention (P1xx)
- Response (P3xx)
- Storage (P4xx)
- Disposal (P5xx)
- Examples:
  - P210: Keep away from heat/sparks/open flames
  - P280: Wear protective gloves/eye protection
  - P310: Immediately call POISON CENTER/doctor
  - P501: Dispose of contents/container to...

**7. Supplemental Information**
- Physical state, route of exposure
- Percentage of ingredient with unknown acute toxicity

**Label Size Requirements:**
| Container Capacity | Minimum Dimensions |
|-------------------|-------------------|
| ≤ 3 liters | 52 × 74 mm |
| 3-50 liters | 74 × 105 mm |
| 50-500 liters | 105 × 148 mm |
| > 500 liters | 148 × 210 mm |

**Small Container Exemptions:**
- May use reduced label for ≤ 125ml
- Must include: Product ID, pictogram, signal word, supplier
- Full info on outer packaging

**Workplace Labels (US OSHA):**
- Product identifier
- Words/pictures indicating hazards
- Can use GHS pictograms or NFPA/HMIS systems

---

# Dangerous Goods Transport Classification
Source: src/features/comprehensive-chatbot/SDSAndLabeling.ts
Domain: sixsigma
Category: Safety Documentation
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Dangerous Goods Transport (ADR/RID/IMDG/IATA)**

**UN Classification (9 Classes)**

**Class 1: Explosives**
- 1.1: Mass explosion hazard
- 1.2: Projection hazard
- 1.3: Fire hazard
- 1.4: No significant hazard
- 1.5: Insensitive explosives
- 1.6: Extremely insensitive

**Class 2: Gases**
- 2.1: Flammable gases
- 2.2: Non-flammable, non-toxic
- 2.3: Toxic gases

**Class 3: Flammable Liquids**
- Flash point < 60°C

**Class 4: Flammable Solids**
- 4.1: Flammable solids
- 4.2: Spontaneously combustible
- 4.3: Dangerous when wet

**Class 5: Oxidizing Substances**
- 5.1: Oxidizers
- 5.2: Organic peroxides

**Class 6: Toxic and Infectious**
- 6.1: Toxic substances
- 6.2: Infectious substances

**Class 7: Radioactive Material**

**Class 8: Corrosive Substances**

**Class 9: Miscellaneous**
- Environmentally hazardous
- Lithium batteries
- Magnetized material

**Transport Document Requirements:**
- UN number (4-digit)
- Proper shipping name
- Hazard class
- Packing group (I, II, III)
- Total quantity
- Emergency contact

**Limited Quantities (LQ):**
- Smaller packaging exemptions
- Max net quantity per inner packaging
- Marked with LQ diamond
- Reduced requirements

**Excepted Quantities:**
- Very small amounts
- Max 30g/30ml per inner packaging
- Specific packaging required
- No dangerous goods declaration

**Lithium Batteries:**
- UN 3480 (Li-ion, standalone)
- UN 3481 (Li-ion, with equipment)
- UN 3090 (Li-metal, standalone)
- UN 3091 (Li-metal, with equipment)
- Section II, IB, or Section I based on Watt-hour/mass

**Special Provisions:**
- 188: Limited quantities
- 310/314: Lithium batteries
- Various substance-specific provisions

---

# ISO 9001:2015 Internal Audit Checklist
Source: src/features/comprehensive-chatbot/AuditChecklists.ts
Domain: sixsigma
Category: Audit
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**ISO 9001:2015 Internal Audit Checklist**

**Context of the Organization (Clause 4)**
- [ ] External/internal issues identified and monitored
- [ ] Interested parties and requirements determined
- [ ] Scope of QMS defined (facilities, processes, exclusions)
- [ ] Processes identified and sequence/interaction mapped
- [ ] Process inputs, outputs, resources, responsibilities defined

**Leadership (Clause 5)**
- [ ] Top management demonstrates leadership and commitment
- [ ] Quality policy established, communicated, understood
- [ ] Organizational roles, responsibilities, authorities assigned
- [ ] Management promotes process approach and risk-based thinking

**Planning (Clause 6)**
- [ ] Quality objectives established at relevant functions/levels
- [ ] Objectives measurable, monitored, communicated, updated
- [ ] Planning for changes (systematic approach)
- [ ] Risks and opportunities identified and addressed
- [ ] Plans to achieve quality objectives

**Support (Clause 7)**
- [ ] Resources determined and provided (people, infrastructure, environment)
- [ ] Competence requirements defined, training provided, records maintained
- [ ] Awareness of quality policy, objectives, benefits of QMS
- [ ] Communication processes (what, when, with whom, how)
- [ ] Documented information controlled (creation, update, access, retention)

**Operation (Clause 8)**
- [ ] Operational planning and control (process criteria, resources, control)
- [ ] Requirements for products/services determined
- [ ] Review of requirements (capability to meet, contract changes)
- [ ] Design and development process established
- [ ] Design inputs, outputs, reviews, verification, validation controlled
- [ ] Design changes controlled
- [ ] Externally provided processes, products, services controlled
- [ ] Supplier evaluation and selection criteria
- [ ] Production and service provision under controlled conditions
- [ ] Identification and traceability maintained
- [ ] Customer/external provider property controlled
- [ ] Preservation of product (handling, packaging, storage, protection)
- [ ] Post-delivery activities defined and performed
- [ ] Nonconforming outputs identified and controlled

**Performance Evaluation (Clause 9)**
- [ ] Monitoring and measurement of processes and products
- [ ] Customer satisfaction monitored and reviewed
- [ ] Analysis and evaluation of data (trends, improvement opportunities)
- [ ] Internal audits conducted at planned intervals
- [ ] Audit program planned, auditors objective and impartial
- [ ] Audit results reported to management
- [ ] Management reviews conducted (inputs and outputs)

**Improvement (Clause 10)**
- [ ] Nonconformities identified and reacted to
- [ ] Corrective actions implemented for nonconformities
- [ ] Corrective action effectiveness evaluated
- [ ] Continual improvement opportunities identified and implemented

**Audit Tips:**
- Interview personnel at all levels
- Review records and documented information
- Observe processes in action
- Verify traceability through the process
- Check linkages between clauses
- Sample records (recent and older)

---

# FDA Inspection Preparation
Source: src/features/comprehensive-chatbot/AuditChecklists.ts
Domain: sixsigma
Category: Audit
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**FDA Inspection Preparation Guide**

**Types of FDA Inspections:**
1. **Pre-Approval Inspection (PAI)** - Before product approval
2. **Routine Surveillance** - Biennial for medical devices
3. **For-Cause Inspection** - Complaint, recall, or signal
4. **Compliance Follow-up** - After warning letter

**Pre-Inspection Preparation (30-60 days before):**

**Documentation Review:**
- [ ] All SOPs current and being followed
- [ ] Training records complete and current
- [ ] Calibration records current and complete
- [ ] Complaint files organized with investigations
- [ ] MDR/AE reports filed on time
- [ ] CAPAs documented with effectiveness checks
- [ ] Supplier files with approved supplier list
- [ ] Design history files complete (DHF)
- [ ] Device master records (DMR) current
- [ ] Device history records (DHR) complete

**Facility Preparation:**
- [ ] 5S housekeeping throughout facility
- [ ] Cleaning validation current
- [ ] Environmental monitoring data available
- [ ] Pest control documentation current
- [ ] Temperature/humidity logs complete

**Key Personnel Preparation:**
- [ ] Management representative briefed
- [ ] Quality unit prepared
- [ ] Production supervisors briefed
- [ ] Subject matter experts available
- [ ] Scribes assigned for each inspector

**During the Inspection:**

**Opening Meeting:**
- Present organization chart
- Brief company overview
- Introduce key personnel
- Establish ground rules

**Do's:**
- Be truthful and cooperative
- Answer only what is asked
- Provide documents promptly
- Escort inspector at all times
- Take detailed notes
- Correct minor issues immediately if possible

**Don'ts:**
- Don't volunteer information
- Don't guess or speculate
- Don't argue with inspector
- Don't hide anything
- Don't provide draft documents
- Don't allow inspector to wander alone

**Common FDA Form 483 Observations:**
1. Procedures not fully followed
2. Inadequate complaint investigations
3. Missing or inadequate CAPAs
4. Training gaps
5. Calibration deficiencies
6. Document control issues
7. Supplier control weaknesses

**Responding to 483:**
- Acknowledge receipt within 15 days
- Provide detailed response with corrections
- Include timelines for implementation
- Provide objective evidence of effectiveness
- Be specific, not vague promises

**Warning Letter Response:**
- Comprehensive action plan
- Root cause analysis
- Corrective and preventive actions
- Timeline with milestones
- Management commitment statement
- May require independent third-party review

---

# Layered Process Audit (LPA) Template
Source: src/features/comprehensive-chatbot/AuditChecklists.ts
Domain: sixsigma
Category: Audit
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Layered Process Audit (LPA) Program**

**Purpose:** Verify process conformance at all levels, prevent defects, ensure standards maintained.

**Audit Frequency by Layer:**
| Layer | Auditor | Frequency | Duration |
|-------|---------|-----------|----------|
| 1 | Operators/Supervisors | Daily/Shift | 10-15 min |
| 2 | Managers | Weekly | 15-30 min |
| 3 | Senior Management | Monthly | 30-60 min |

**LPA Checklist Template:**

**Standardized Work**
- [ ] Current work instruction posted and legible
- [ ] Operator following sequence of steps
- [ ] Cycle time within target
- [ ] Quality checks performed as specified

**Quality Controls**
- [ ] Gauges calibrated and within due date
- [ ] Measurement frequency being followed
- [ ] SPC charts current and reviewed
- [ ] Reaction plan posted and understood
- [ ] Defect examples displayed at station

**Error Proofing (Poka-Yoke)**
- [ ] Error-proofing devices functional
- [ ] Sensors verified/calibrated
- [ ] Bypass procedures understood (if any)
- [ ] Andon/light system working

**5S and Visual Management**
- [ ] Work area clean and organized
- [ ] Tools in designated locations
- [ ] Labels and signs legible
- [ ] Walkways clear and marked
- [ ] Shadow boards used where applicable

**Material and WIP**
- [ ] Correct material at station
- [ ] First In First Out (FIFO) followed
- [ ] WIP within standard limits
- [ ] Material properly identified/labeled

**Equipment and Maintenance**
- [ ] Equipment clean and maintained
- [ ] TPM activities performed
- [ ] Oil levels checked
- [ ] Abnormal sounds or vibrations reported

**Safety**
- [ ] PPE worn correctly
- [ ] Safety devices in place
- [ ] Emergency stops accessible
- [ ] No unsafe conditions observed

**Employee Knowledge**
- [ ] Operator can explain quality checks
- [ ] Operator knows reaction plan
- [ ] Operator can explain stop/call/wait
- [ ] Training records current

**Scoring:**
- Green (✓): Compliant
- Yellow (△): Minor issue, address today
- Red (✗): Major non-conformance, stop and fix

**Follow-up:**
- Issues logged immediately
- Assign owner and due date
- Verify closure at next audit
- Track trends by area/shift

**LPA Software Options:**
- EASE (Auditing Software)
- Beacon Quality
- Tervene
- Excel-based (for small programs)

**Success Factors:**
- Management commitment
- No punitive use of findings
- Rapid response to issues
- Continuous improvement of checklists
- Layer participation (not just quality)

---

# ESG Fundamentals and Frameworks
Source: src/features/comprehensive-chatbot/ESGSustainability.ts
Domain: sixsigma
Category: ESG
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**ESG (Environmental, Social, Governance) Overview**

**What is ESG?**
Framework for measuring sustainability and ethical impact of investments/companies.

**Three Pillars:**

**Environmental:**
- Climate change mitigation
- Carbon emissions (Scope 1, 2, 3)
- Resource depletion
- Waste and pollution
- Deforestation
- Biodiversity

**Social:**
- Employee relations and diversity
- Working conditions
- Human rights
- Community relations
- Product safety
- Data privacy

**Governance:**
- Executive compensation
- Board diversity
- Audit committee structure
- Bribery and corruption
- Political contributions
- Whistleblower programs

**Major ESG Frameworks:**

**1. GRI (Global Reporting Initiative)**
- Most widely used sustainability framework
- Comprehensive, multi-stakeholder approach
- Topic-specific standards (GRI 300 for Environment)

**2. SASB (Sustainability Accounting Standards Board)**
- Industry-specific standards
- Focus on financially material issues
- Now part of IFRS Foundation

**3. TCFD (Task Force on Climate-related Financial Disclosures)**
- Climate-specific framework
- Focus on governance, strategy, risk management, metrics
- Becoming mandatory in many jurisdictions

**4. CDP (Carbon Disclosure Project)**
- Climate, water, forests focus
- Annual questionnaire
- Scored A through F

**5. EU Taxonomy**
- Classification system for sustainable activities
- Technical screening criteria
- "Substantial contribution" requirements

**ESG Ratings Agencies:**
- MSCI
- Sustainalytics
- ISS ESG
- CDP
- EcoVadis (supply chain focus)

**Materiality Assessment:**
1. Identify ESG topics relevant to industry
2. Assess impact on stakeholders
3. Evaluate financial materiality
4. Prioritize for reporting/action

---

# Carbon Footprint and GHG Accounting
Source: src/features/comprehensive-chatbot/ESGSustainability.ts
Domain: sixsigma
Category: ESG
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Greenhouse Gas (GHG) Protocol**

**Scope 1: Direct Emissions**
- Company-owned/controlled sources
- Stationary combustion (boilers, furnaces)
- Mobile combustion (fleet vehicles)
- Process emissions
- Fugitive emissions (leaks)

**Scope 2: Indirect Emissions (Energy)**
- Purchased electricity
- Purchased steam, heating, cooling
- Two methods:
  - Location-based (grid average)
  - Market-based (contractual instruments)

**Scope 3: Value Chain Emissions (15 Categories)**
1. Purchased goods and services
2. Capital goods
3. Fuel and energy-related activities
4. Upstream transportation and distribution
5. Waste generated in operations
6. Business travel
7. Employee commuting
8. Upstream leased assets
9. Downstream transportation and distribution
10. Processing of sold products
11. Use of sold products
12. End-of-life treatment of sold products
13. Downstream leased assets
14. Franchises
15. Investments

**Calculation Formula:**
Emissions = Activity Data × Emission Factor

Example: Electricity (kWh) × Grid EF (kg CO2e/kWh) = kg CO2e

**Common Emission Factors:**
- EPA GHG Emission Factors Hub
- DEFRA (UK)
- IEA
- Supplier-specific factors

**Science-Based Targets (SBTi):**
- 1.5°C pathway: Reduce 42% by 2030 (from 2020)
- Well-below 2°C: 25% reduction by 2030
- Net-zero by 2050

**Carbon Offsetting:**
- Avoidance/reduction projects
- Removal projects (reforestation, DAC)
- Quality criteria: Additionality, permanence, leakage, verification
- Standards: Verra VCS, Gold Standard, CAR

**Product Carbon Footprint (PCF):**
- Cradle-to-gate: Raw materials to factory gate
- Cradle-to-grave: Full lifecycle including use and disposal
- ISO 14067 standard
- Industry initiatives: Together for Sustainability (TfS)

**EU CBAM (Carbon Border Adjustment Mechanism):**
- Import declarations for carbon-intensive goods
- Cement, iron/steel, aluminum, fertilizers, electricity, hydrogen
- Phased implementation 2023-2026
- Full implementation 2026 with financial adjustments

---

# EU CSRD (Corporate Sustainability Reporting Directive)
Source: src/features/comprehensive-chatbot/ESGSustainability.ts
Domain: sixsigma
Category: ESG
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**EU CSRD - Corporate Sustainability Reporting Directive**

**Who Must Report:**
- Large EU companies (>250 employees OR >€40M turnover OR >€20M assets)
- Listed SMEs (exemption until 2026)
- Non-EU companies with >€150M EU turnover and EU subsidiary/branch

**Timeline:**
- FY 2024: Companies already under NFRD
- FY 2025: Other large companies
- FY 2026: Listed SMEs, small and non-complex credit institutions, captive insurance
- FY 2028: Non-EU companies

**Reporting Standards: ESRS (European Sustainability Reporting Standards)**

**Cross-Cutting Standards:**
- ESRS 1: General Requirements
- ESRS 2: General Disclosures

**Topic Standards (Environmental):**
- E1: Climate Change
- E2: Pollution
- E3: Water and Marine Resources
- E4: Biodiversity and Ecosystems
- E5: Resource Use and Circular Economy

**Topic Standards (Social):**
- S1: Own Workforce
- S2: Workers in Value Chain
- S3: Affected Communities
- S4: Consumers and End-users

**Topic Standards (Governance):**
- G1: Business Conduct

**Key Requirements:**
1. Double Materiality Assessment
   - Impact materiality (outward)
   - Financial materiality (inward)

2. Value Chain Reporting
   - Upstream and downstream impacts
   - Use estimates if data unavailable

3. Forward-looking Information
   - Targets and transition plans
   - Climate scenario analysis

4. Digital Reporting
   - XBRL-tagged, machine-readable
   - European Single Access Point (ESAP)

**Audit Requirements:**
- Limited assurance required initially
- Reasonable assurance by 2028
- By statutory auditor or independent assurance provider

**Comparison to Previous NFRD:**
- 4x more companies covered
- More detailed reporting requirements
- Mandatory assurance
- Digital format required
- Broader scope (value chain, forward-looking)

**Penalties:**
- Set by member states
- Public "naming and shaming"
- Potential exclusion from public procurement

**Preparation Steps:**
1. Conduct double materiality assessment
2. Identify data gaps
3. Establish governance and processes
4. Engage value chain partners
5. Develop reporting infrastructure

---

# Circular Economy and Zero Waste
Source: src/features/comprehensive-chatbot/ESGSustainability.ts
Domain: sixsigma
Category: ESG
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Circular Economy Principles**

**Linear vs Circular:**
- Linear: Take → Make → Dispose
- Circular: Reduce → Reuse → Recycle → Recover

**R-Strategies (10 Rs):**

**Smarter Product Use:**
1. Refuse: Do not use material
2. Rethink: Make product use more intense
3. Reduce: Increase efficiency in production/use
4. Reuse: Use product again for same purpose
5. Repair: Fix and maintain product

**Extending Lifespan:**
6. Refurbish: Restore to good condition
7. Remanufacture: Rebuild to original specs
8. Repurpose: Use for different function

**Useful Applications:**
9. Recycle: Process to recover materials
10. Recover: Incineration with energy recovery

**Circular Business Models:**

**1. Circular Supplies:**
- Use renewable, recyclable materials
- Example: Biodegradable packaging

**2. Resource Recovery:**
- Recover valuable resources from waste streams
- Example: Chemical recycling of plastics

**3. Product Life Extension:**
- Repair, upgrade, resell
- Example: Electronics refurbishment programs

**4. Sharing Platforms:**
- Shared use of products
- Example: Tool libraries, car sharing

**5. Product as a Service:**
- Lease instead of sell
- Example: Chemical management services

**Zero Waste to Landfill:**
- 90%+ diversion from landfill
- Hierarchy: Source reduction → Reuse → Recycling → Composting → Energy recovery
- Verification: UL 2799 Zero Waste to Landfill

**Packaging Sustainability:**
- Design for recycling
- Reduce material (lightweighting)
- Recycled content
- Compostable/biodegradable alternatives
- Reusable packaging systems

**Extended Producer Responsibility (EPR):**
- Producers responsible for end-of-life
- Packaging EPR schemes (EU, Canada)
- WEEE (electronics)
- Batteries

**Metrics:**
- Recycling rate
- Recycled content %
- Waste diversion rate
- Packaging recyclability
- Circularity index (materials reclaimed/reused)

---

# ERP Software 1
Source: src/features/comprehensive-chatbot/QualitySoftwareSystems.ts
Domain: sixsigma
Category: ERP Software
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Sage 100 ERP for Manufacturing and Quality**

**Overview:**
Sage 100 is a mid-market ERP solution popular with small to medium manufacturers (10-500 employees). Strong in accounting, inventory, and basic manufacturing.

**Key Modules for Quality:**

**1. Inventory Management:**
- Lot/Serial tracking
- Expiration date management
- Bin tracking
- ABC analysis
- Cycle counting support
- Quality hold functionality

**2. Bill of Materials (BOM):**
- Multi-level BOMs
- Revision control
- Where-used inquiry
- Component substitution
- Engineering change control (via ECN module)

**3. Work Order Processing:**
- Production tracking
- Labor collection
- Material issues
- Scrap reporting
- Outside processing

**4. Purchase Order:**
- Inspection required flag
- Certificate of compliance tracking
- Vendor performance metrics
- Receiving inspection hold

**5. Sales Order:**
- Certificate of analysis printing
- Quality documentation attachment
- Customer-specific requirements

**Quality-Related Features:**

**Lot Tracking:**
- Full forward/backward traceability
- Lot recall capabilities
- Expiration monitoring
- FEFO/FIFO support

**Inspection Integration:**
- Receiving inspection queues
- QC status (Approved, Hold, Rejected)
- Inspection data entry (via customization or add-on)

**Reporting for Quality:**
- Inventory valuation
- Lot traceability reports
- Production variance analysis
- Vendor performance
- Scrap analysis

**Add-ons for Enhanced Quality:**

**Paperless Manufacturing:**
- Electronic work instructions
- Shop floor data collection
- Real-time production visibility

**Sage Quality Management (3rd party):**
- Non-conformance tracking
- CAPA management
- Document control
- Audit management

**Integration Capabilities:**
- Microsoft Office (Word/Excel)
- BI tools (Sage Intelligence, Power BI)
- EDI integration
- Barcode scanning

**Limitations for Advanced Quality:**
- No native SPC/statistical analysis
- Limited document management
- Basic calibration tracking (custom fields)
- No FMEA/Control Plan tools
- Limited supplier management

**Compliance Support:**
- 21 CFR Part 11: Limited (electronic signatures via add-on)
- ISO 9001: Supports document control, training records, CAPA (with add-ons)
- Traceability: Good lot/serial tracking

**Best For:**
- Discrete manufacturers
- Job shops
- Make-to-order
- Distribution companies
- Small-medium business

**Not Ideal For:**
- Process manufacturing (batch)
- FDA-regulated medical devices (without extensive customization)
- Aerospace AS9100 (limited configuration management)
- Companies needing advanced QMS features

**Migration Path:**
- Sage 100cloud (subscription-based)
- Sage X3 (larger, more complex manufacturing)
- 3rd party QMS integration (MasterControl, EtQ)

---

# QMS Software 2
Source: src/features/comprehensive-chatbot/QualitySoftwareSystems.ts
Domain: sixsigma
Category: QMS Software
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**IQMS / DELMIAWorks - Manufacturing ERP and QMS**

**Overview:**
IQMS is a comprehensive manufacturing ERP with strong integrated quality management. Now part of Dassault Systèmes as DELMIAWorks. Popular in plastics, medical device, and automotive.

**Core Quality Modules:**

**1. Quality Management System (QMS):**
- Non-conformance tracking (NCR)
- Corrective/Preventive Action (CAPA)
- Supplier corrective action requests (SCAR)
- Customer complaint management
- Audit management (internal, external, layer process)
- Risk assessment (FMEA)

**2. Document Control:**
- Controlled document repository
- Version control
- Approval workflows
- Electronic signatures (21 CFR Part 11 compliant)
- Training documentation linked to documents
- Obsolescence management

**3. Calibration Management:**
- Equipment calibration scheduling
- Calibration procedure storage
- Calibration data entry
- Measurement uncertainty tracking
- Calibration label printing
- Alert notifications for due calibrations

**4. Gage R&R Studies:**
- Built-in Gage R&R calculation
- ANOVA method support
- Gage tracking database
- Calibration and R&R history

**5. SPC (Statistical Process Control):**
- Real-time SPC from shop floor
- Control charts (X-bar, R, S, I-MR, p, np, c, u)
- Cpk/Ppk calculation
- Out-of-control alerting
- Pattern detection rules (Western Electric)

**6. Supplier Quality:**
- Supplier rating system
- Receiving inspection
- Certificate of compliance tracking
- Supplier audit scheduling
- Approved vendor list (AVL)
- Supplier scorecards

**7. Inspection Planning:**
- AQL sampling plans (MIL-STD-105E, ANSI/ASQ Z1.4)
- In-process inspection
- Final inspection
- Inspection data collection
- First Article Inspection (FAI)

**8. Traceability:**
- Lot/Serial control
- Full genealogy tracking
- Container hierarchy
- Shelf life management
- Recall management tools

**Regulatory Compliance:**

**FDA 21 CFR Part 820 (QSR):**
- Device history records (DHR)
- Device master records (DMR)
- Training records
- CAPA system
- Electronic signatures

**ISO 13485 (Medical Devices):**
- Risk management integration
- Design controls
- Validation documentation
- Post-market surveillance

**IATF 16949 (Automotive):**
- APQP support
- PPAP management
- Control plans
- FMEA
- SPC
- MSA

**AS9100 (Aerospace):**
- Configuration management
- First article inspection
- Counterfeit parts prevention
- Key characteristics tracking

**Industry-Specific Features:**

**Plastics/Injection Molding:**
- Machine integration (real-time)
- Process monitoring
- Cavity-specific tracking
- Regrind management
- Mold maintenance scheduling

**Medical Devices:**
- UDI (Unique Device Identification)
- EUDAMED reporting support
- Risk management file (ISO 14971)
- Design history file (DHF)
- Clinical data management

**Food & Beverage:**
- Lot traceability
- Allergen tracking
- Quality hold/quarantine
- COA generation
- Recall management

**Mobile Capabilities:**
- Mobile quality inspection
- Shop floor data collection
- Barcode/RFID scanning
- Real-time alerts
- Offline mode

**Reporting and Analytics:**
- Real-time dashboards
- Quality KPIs (PPM, COPQ, OEE)
- Audit trails
- Executive quality reports
- Drill-down capabilities

**Integration:**
- Native ERP integration (no separate QMS)
- CAD integration (SolidWorks)
- MES integration
- CRM integration
- Business intelligence (Power BI)

**Implementation:**
- On-premise or cloud deployment
- Typical implementation: 6-12 months
- Requires data migration planning
- Training programs available
- Ongoing support

**Pricing:**
- Subscription-based (per user/month)
- Typically $150-300/user/month
- Implementation services additional
- Maintenance included in subscription

**Best For:**
- Mid-size manufacturers (50-500 employees)
- Regulated industries (medical, automotive)
- Companies wanting integrated ERP+QMS
- Manufacturers needing real-time SPC
- Multi-site operations

**Not Ideal For:**
- Small companies (<$5M revenue)
- Simple distributors
- Companies needing only basic accounting
- Organizations wanting best-of-breed separate systems

---

# Computer Vision for Defect Detection
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Computer Vision for Automated Defect Detection**

**Overview:**
AI-powered computer vision systems use cameras and deep learning algorithms to automatically detect defects in manufacturing processes, replacing or augmenting human inspection.

**Technology Stack:**
- **Deep Learning Models:** Convolutional Neural Networks (CNNs), YOLO, ResNet
- **Hardware:** High-resolution industrial cameras, GPU processing units
- **Software:** TensorFlow, PyTorch, OpenCV, custom vision platforms

**Applications:**
| Industry | Defect Type | Detection Capability |
|----------|-------------|---------------------|
| Automotive | Surface scratches, paint defects, weld quality | 99.5%+ accuracy |
| Electronics | Solder joint defects, component placement, PCB traces | Real-time detection |
| Textiles | Fabric defects, color variations, stitching errors | 0.1mm precision |
| Food & Beverage | Foreign object detection, packaging integrity | X-ray + vision fusion |
| Pharmaceuticals | Tablet defects, packaging labels, contamination | FDA 21 CFR Part 11 compliant |

**Implementation Steps:**
1. **Data Collection:** Capture thousands of images (good and defective)
2. **Annotation:** Label defects with bounding boxes or segmentation masks
3. **Model Training:** Train CNN on annotated dataset (typically 80/20 train/test split)
4. **Validation:** Test on holdout dataset, optimize for precision/recall
5. **Deployment:** Edge computing or cloud-based inference
6. **Continuous Learning:** Retrain with new defect types

**Key Metrics:**
- **Precision:** True positives / (True positives + False positives)
- **Recall:** True positives / (True positives + False negatives)
- **F1 Score:** Harmonic mean of precision and recall
- **Inference Time:** Typically 10-100ms per image for real-time applications

**ROI Considerations:**
- Labor cost reduction: 50-80% of inspection staff
- Detection rate improvement: 20-40% over human inspection
- False positive reduction: 60-90% compared to rule-based systems
- Payback period: 12-24 months typical

**Challenges:**
- Requires large labeled datasets (1000+ images per defect type)
- Lighting and positioning consistency critical
- Concept drift when product designs change
- Integration with existing MES/QMS systems

---

# Predictive Quality Analytics
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Predictive Quality Analytics**

**Overview:**
Use machine learning to predict quality issues before they occur, enabling proactive intervention rather than reactive correction.

**Types of Predictions:**

**1. Quality Failure Prediction:**
- Predict which units will fail quality checks
- Input: Process parameters, sensor data, environmental conditions
- Output: Probability of defect/failure
- Action: Stop production, adjust parameters, or flag for inspection

**2. Process Drift Detection:**
- Monitor for gradual degradation in process capability
- Statistical process control + ML anomaly detection
- Early warning when Cpk trending downward

**3. Equipment Failure Prediction:**
- Predict machine breakdowns that cause quality issues
- Vibration, temperature, current signature analysis
- Preventive maintenance scheduling

**Machine Learning Models Used:**

| Model Type | Use Case | Accuracy |
|------------|----------|----------|
| Random Forest | Feature importance, defect classification | 85-95% |
| Gradient Boosting (XGBoost) | Quality prediction, ranking | 90-97% |
| Neural Networks | Complex non-linear relationships | 88-96% |
| Time Series (LSTM) | Sequential process data, trend prediction | 85-93% |
| Anomaly Detection (Isolation Forest) | Outlier detection, novel defects | 80-90% |

**Data Requirements:**
- Historical quality data (pass/fail, defect types)
- Process parameters (temperature, pressure, speed, etc.)
- Sensor data (vibration, acoustic, electrical)
- Environmental conditions (humidity, ambient temperature)
- Maintenance records

**Implementation Framework:**
1. **Data Integration:** Connect to SCADA, MES, QMS databases
2. **Feature Engineering:** Create relevant features from raw data
3. **Model Development:** Train and validate prediction models
4. **Real-time Scoring:** Deploy models for live prediction
5. **Alert System:** Notify operators when risk threshold exceeded
6. **Feedback Loop:** Track prediction accuracy and retrain

**Business Impact:**
- Scrap reduction: 25-50%
- Rework reduction: 30-60%
- First-pass yield improvement: 10-20%
- Customer complaints reduction: 40-70%

**Example Use Case - Injection Molding:**
Inputs: Barrel temperature, injection pressure, cooling time, material moisture
Prediction: Probability of sink marks, warpage, or short shots
Action: Automatically adjust parameters or alert operator

---

# Digital Twins for Quality Simulation
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Digital Twins for Quality Simulation**

**Overview:**
A digital twin is a virtual replica of a physical product, process, or system that uses real-time data and AI models to simulate behavior, predict outcomes, and optimize quality.

**Types of Digital Twins:**

**1. Product Digital Twin:**
- Virtual representation of physical product
- Simulates performance under various conditions
- Predicts failure modes and lifetime
- Applications: Aerospace components, automotive parts, medical devices

**2. Process Digital Twin:**
- Virtual model of manufacturing process
- Simulates cause-effect relationships
- Optimizes parameters for quality outcomes
- Applications: CNC machining, welding, chemical processing

**3. System Digital Twin:**
- Models entire production system
- Simulates interactions between processes
- Optimizes flow and resource allocation
- Applications: Smart factories, supply chains

**Technology Components:**
- **CAD/CAE Models:** Physics-based simulations (FEA, CFD)
- **IoT Sensors:** Real-time data from physical assets
- **AI/ML Models:** Data-driven predictions and optimizations
- **Visualization:** 3D models, dashboards, VR/AR interfaces

**Quality Applications:**

| Application | Description | Benefit |
|-------------|-------------|---------|
| Virtual Commissioning | Test processes before physical implementation | 50-70% faster startup |
| Parameter Optimization | AI suggests optimal settings | 15-30% quality improvement |
| What-if Analysis | Simulate changes without production risk | Zero-cost experimentation |
| Root Cause Analysis | Trace quality issues through virtual model | 60-80% faster problem solving |
| Predictive Maintenance | Anticipate equipment failures | 25-40% maintenance cost reduction |

**Implementation Process:**
1. **Model Creation:** Build physics-based or data-driven model
2. **Data Integration:** Connect to real-time sensor feeds
3. **Calibration:** Validate model accuracy against physical system
4. **Simulation:** Run scenarios and optimizations
5. **Deployment:** Integrate recommendations into operations
6. **Evolution:** Continuously update model with new data

**Example - Welding Quality:**
Digital twin simulates weld pool dynamics based on:
- Voltage, current, wire feed speed
- Travel speed, torch angle
- Material properties, shielding gas
Predicts: Penetration depth, porosity risk, heat-affected zone
Optimizes: Parameters for defect-free welds

**ROI Metrics:**
- Reduction in physical prototyping: 40-60%
- Quality improvement: 15-25%
- Time to market reduction: 20-30%
- Operational cost savings: 10-20%

---

# NLP for Quality Documentation & Complaint Analysis
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**Natural Language Processing (NLP) for Quality**

**Overview:**
NLP uses AI to analyze unstructured text data from quality documentation, customer complaints, audit reports, and regulatory filings.

**Applications:**

**1. Customer Complaint Analysis:**
- Automatically categorize complaint types
- Extract sentiment and urgency
- Identify emerging quality issues
- Route to appropriate teams

**2. Root Cause Analysis from Text:**
- Analyze corrective action reports
- Extract contributing factors
- Identify patterns across incidents
- Suggest preventive actions

**3. Document Processing:**
- Extract data from COAs (Certificates of Analysis)
- Parse supplier quality agreements
- Analyze audit findings
- Automate regulatory submission review

**4. Voice of Customer (VoC) Mining:**
- Analyze social media, reviews, surveys
- Extract quality-related themes
- Track sentiment trends over time
- Identify competitive advantages/gaps

**NLP Techniques:**

| Technique | Application | Example |
|-----------|-------------|---------|
| Text Classification | Categorize complaints | "Defect", "Packaging", "Shipping" |
| Named Entity Recognition | Extract specific info | Product codes, dates, locations |
| Sentiment Analysis | Gauge customer satisfaction | Positive/Negative/Neutral scores |
| Topic Modeling | Discover themes | Latent issues in complaints |
| Text Summarization | Condense long reports | Executive summaries |
| Keyword Extraction | Identify important terms | "crack", "discoloration", "late" |

**Implementation Example - Complaint Analysis:**
Input: "The product arrived damaged. Box was crushed and seal was broken. Item had scratches."
NLP Output:
- Category: Shipping Damage
- Severity: High
- Sentiment: Negative (0.85)
- Keywords: damaged, crushed, broken, scratches
- Action: Route to logistics team, flag for packaging review

**Tools & Platforms:**
- **Cloud APIs:** AWS Comprehend, Google Cloud NLP, Azure Text Analytics
- **Open Source:** spaCy, NLTK, Hugging Face Transformers
- **Specialized:** Qualtrics Text iQ, Medallia, Clarabridge

**Quality Impact:**
- Complaint processing time: 70-90% reduction
- Issue detection speed: 60-80% faster
- Data entry errors: 50-80% reduction
- Customer response time: 50-70% improvement

**Best Practices:**
- Build industry-specific training datasets
- Regularly retrain models with new data
- Validate automated classifications
- Maintain human oversight for critical decisions

---

# AI-Driven Process Optimization
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**AI-Driven Process Optimization**

**Overview:**
Use reinforcement learning and optimization algorithms to automatically adjust process parameters in real-time to maximize quality and efficiency.

**Optimization Techniques:**

**1. Reinforcement Learning (RL):**
- Agent learns optimal actions through trial and error
- Reward function based on quality metrics
- Continuously adapts to changing conditions
- Applications: Chemical processes, heat treatment, coating

**2. Bayesian Optimization:**
- Efficiently searches parameter space
- Balances exploration vs exploitation
- Fewer experiments needed than traditional DOE
- Applications: New product/process development

**3. Genetic Algorithms:**
- Evolutionary approach to parameter optimization
- Good for complex, multi-modal problems
- Applications: Scheduling, recipe optimization

**Real-time Process Control:**

| Component | Function | AI Technology |
|-----------|----------|---------------|
| Sensors | Collect process data | IoT, smart sensors |
| Edge AI | Local real-time analysis | Edge computing, TinyML |
| Control System | Adjust parameters | MPC, PID + AI tuning |
| Cloud AI | Complex optimization | Deep learning, big data |

**Example - Chemical Process:**
Variables: Temperature, pressure, catalyst concentration, flow rate
Constraints: Safety limits, equipment limits, quality specs
AI Action: Continuously adjust variables to maintain Cpk > 1.33
Result: 15% yield improvement, 30% energy reduction

**Benefits:**
- Consistent quality despite variations
- Reduced operator dependence
- Faster response to disturbances
- Continuous improvement over time

**Challenges:**
- Requires robust safety systems
- Need extensive historical data
- Change management with operators
- Regulatory validation for critical processes

---

# MLOps for Quality Systems
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**MLOps for Quality Systems**

**Overview:**
MLOps (Machine Learning Operations) applies DevOps principles to ML models in quality systems, ensuring reliable, scalable, and maintainable AI deployments.

**MLOps Lifecycle for Quality:**

**1. Data Management:**
- Data versioning (DVC, LakeFS)
- Data quality monitoring
- Automated data validation
- Bias detection in training data

**2. Model Development:**
- Experiment tracking (MLflow, Weights & Biases)
- Hyperparameter optimization
- Model versioning
- Reproducible pipelines

**3. Model Validation:**
- Performance metrics tracking
- A/B testing frameworks
- Shadow deployment (test alongside existing system)
- Regulatory compliance validation

**4. Deployment:**
- Containerization (Docker, Kubernetes)
- Edge deployment for real-time inference
- Model serving (TF Serving, TorchServe)
- Blue-green deployments

**5. Monitoring:**
- Model performance drift
- Data distribution drift
- Prediction latency tracking
- Business KPI impact

**6. Retraining:**
- Automated retraining triggers
- Continuous learning pipelines
- Model rollback capabilities

**Quality-Specific Considerations:**

| Aspect | Traditional ML | Quality ML |
|--------|---------------|------------|
| Safety | Important | Critical - must not miss defects |
| Interpretability | Nice to have | Required - explain rejections |
| Latency | Seconds acceptable | Milliseconds for real-time |
| Validation | Holdout test set | Production validation required |
| Compliance | Standard | FDA 21 CFR Part 11, ISO standards |

**Key Metrics to Monitor:**
- **Model Drift:** Performance degradation over time
- **Data Drift:** Input distribution changes
- **Prediction Confidence:** Uncertainty estimates
- **Business Impact:** Quality metrics, cost savings
- **System Health:** Uptime, latency, throughput

**Tools Stack:**
- **Orchestration:** Kubeflow, Apache Airflow, Prefect
- **Monitoring:** Evidently AI, WhyLabs, Arize
- **Feature Store:** Feast, Tecton
- **Deployment:** Seldon, BentoML

**Best Practices:**
- Version everything (data, models, code)
- Implement automated testing
- Maintain model cards (documentation)
- Plan for model retirement/replacement
- Ensure regulatory audit trails

---

# AI for Supply Chain Quality Risk
Source: src/features/comprehensive-chatbot/AIQualityKnowledge.ts
Domain: sixsigma
Category: AI Quality Applications
Belt level: All
Authority: canonical
Last updated: 2026-05-20
**AI for Supply Chain Quality Risk Management**

**Overview:**
Machine learning models predict and mitigate quality risks across the supply chain, from raw material sourcing to finished product delivery.

**Risk Prediction Applications:**

**1. Supplier Quality Risk Scoring:**
- Predict likelihood of supplier quality issues
- Input: Historical performance, financial health, geopolitical factors
- Output: Risk score, recommended inspection level

**2. Raw Material Quality Prediction:**
- Predict material properties before testing
- Input: Supplier data, shipping conditions, certificate of analysis
- Output: Expected quality parameters

**3. Shipping Damage Prediction:**
- Predict damage risk based on route, carrier, packaging
- Input: Weather, handling history, route complexity
- Output: Risk level, insurance recommendations

**4. Counterfeit Detection:**
- Identify suspicious suppliers or products
- Input: Price anomalies, documentation patterns, physical characteristics
- Output: Counterfeit probability

**Data Sources:**
- Supplier audit results
- Incoming inspection data
- Certificate of Analysis (CoA)
- Logistics tracking data
- Weather and environmental data
- Economic indicators
- Geopolitical risk indices

**ML Models for Supply Chain:**

| Model | Use Case | Features |
|-------|----------|----------|
| Gradient Boosting | Supplier risk scoring | Performance history, financial metrics |
| Time Series | Demand forecasting for quality planning | Historical demand, seasonality |
| Graph Neural Networks | Supplier network risk | Multi-tier supplier relationships |
| Anomaly Detection | Unusual shipping patterns | Route deviations, timing anomalies |
| NLP | Contract risk analysis | Terms, clauses, penalty structures |

**Quality Assurance Framework:**
1. **Risk Assessment:** Score all suppliers/materials
2. **Sampling Optimization:** Inspect high-risk items more frequently
3. **Preventive Actions:** Address risks before they materialize
4. **Continuous Monitoring:** Track leading indicators
5. **Feedback Loop:** Update models with new incidents

**Business Benefits:**
- Reduced incoming inspection costs: 30-50%
- Fewer supplier quality escapes: 40-60%
- Reduced supply disruptions: 25-40%
- Lower inventory holding costs: 15-25%

**Example - Supplier Risk Score:**
Inputs: On-time delivery (95%), past defects (2%), financial rating (B), location risk (Medium)
AI Prediction: Risk Score = 6.2/10 (Medium-High)
Recommendation: Increase inspection frequency to 100% for next 3 shipments
