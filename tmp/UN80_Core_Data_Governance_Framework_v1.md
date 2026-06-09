

# **7\. Use Cases**

This section documents the humanitarian use cases that motivated the design of the Core Data Model, and the approach taken to validate that the model is fit for purpose. This section captures the intent, scope, and outcomes at governance level.

## **7.1  Purpose of Use Cases**

Use cases serve two functions in the governance of the Core Data Model:

* **Validation**: they confirm that the Domain structure, dataset selection, and metadata standards are sufficient to answer the questions that humanitarian actors actually ask. A model that cannot support its intended use cases is not fit for purpose.

* **Communication**: they translate an abstract data architecture into concrete, recognisable scenarios that demonstrate value to senior leadership, donors, and partner organisations.

Use cases are not requirements in the traditional software sense. They are representative scenarios drawn from the real operational needs of the humanitarian community that the model should be able to support, either directly Phase 1, or with a clear path in future phases.

## **7.2  Humanitarian Needs Addressed**

The following needs were identified through the domain review process and working group discussions as the primary drivers for the Core Data Model:

| Need | Description | Domains primarily involved |
| :---- | :---- | :---- |
| Situational awareness across crises | Humanitarian coordinators need a single, consistent picture of where emergencies are active, at what severity, and which organisations are responding, without having to reconcile conflicting data from five separate systems. | Emergencies & Situation Definitions, Appeals, Population Domain |
| Funding transparency and gap analysis | Donors and coordination bodies need to understand how much has been requested, how much has been committed, and where gaps remain, linkable to specific crises and population groups. | Funding / Donations, Appeals, Emergencies & Situation Definitions |
| Population movement tracking | Response planners need authoritative, comparable data on displaced populations, who is moving, from where to where, in what numbers without manual reconciliation. | Population Domain, Emergencies & Situation Definitions |
| Risk and early warning | Preparedness teams need to monitor hazard exposure and vulnerability before an emergency is declared, to enable anticipatory action. | Risk Management, Hazardous Events |
| Needs assessment and severity analysis | Programme teams need access to comparable needs assessments across organisations to triangulate severity and prioritise response, without rebuilding each assessment from scratch. | Situation Analysis and Needs, \[Reference Data\] Indicators |
| Cross-domain federated analysis | Analytical teams need to combine data across domains, for example, linking emergency declarations to funding levels, population figures, and protection incidents, without custom data engineering for each query. | All domains |

## **7.3  Illustrative Use Cases**

The following use cases were developed during and after domain review sessions. They are illustrative rather than exhaustive. Each use case includes the humanitarian need being addressed, how the Core Data Model enables it, and sample queries that the model should be able to answer.

| UC-01  Emergency Response Activation |
| :---- |
| **Humanitarian need:**  When a new crisis emerges, coordinators need to rapidly confirm whether a formal emergency declaration exists, at what level (L1/L2/L3), and which appeals or response plans are already active. **How the model helps:**  By linking the Emergencies & Situation Definitions domain to the Appeals domain with shared identifiers, coordinators can query across both with a single request rather than checking five separate systems. **Illustrative queries:** *How many IASC Level 3 emergencies were active in 2024, and which had a corresponding Humanitarian Response Plan?* *Which countries have a declared emergency but no active coordinated appeal?* *What is the average time between emergency declaration and first appeal launch, by emergency type?* |

| UC-02  Funding Gap Analysis |
| :---- |
| **Humanitarian need:**  Donors and coordination bodies need to identify where funding requirements are unmet relative to declared need, and how quickly contributions are arriving. **How the model helps:**  Linking the Funding / Donations domain to the Appeals domain via shared appeal identifiers enables gap analysis without manual data joining. The Emergencies domain provides the crisis context. **Illustrative queries:** *Which countries have active appeals but no confirmed funding disbursements?* *How does funding velocity (pace of contributions in the first 90 days) compare across different appeal types?* *Do crises classified as Level 3 emergencies attract proportionally more funding relative to their stated requirements?* |

| UC-03  Displacement Trend Monitoring |
| :---- |
| **Humanitarian need:**  Programme planners and governments need a consistent, up-to-date picture of population movement, cross-border refugee flows (UNHCR) and internal displacement (IOM), in a single comparable format. **How the model helps:**  The Population Domain harmonises UNHCR and IOM displacement data under a shared domain structure with common metadata, enabling cross-organisation trend analysis without bespoke data pipelines. **Illustrative queries:** *What percentage of conflict emergencies in the past five years involved significant cross-border displacement?* *Which L3 countries have seen the largest increase in IDP stocks in the last 12 months, and is there a corresponding UNHCR refugee flow?* *Which regions have the highest concentration of protracted displacement situations (\>3 years)?* |

| UC-04  Anticipatory Action and Risk Monitoring |
| :---- |
| **Humanitarian need:**  Early warning and preparedness teams need to monitor hazard signals and vulnerability indicators before a crisis reaches emergency level, to trigger anticipatory action. **How the model helps:**  The Risk Management and Hazardous Events domains, combined with structural vulnerability data from Situation Analysis, provide the data foundation for anticipatory triggers, linked to location and population data via reference datasets. **Illustrative queries:** *Which countries with high structural vulnerability also show active hazard signals (e.g. flood forecasting, drought indicators)?* *How has the frequency of climate-related hazardous events changed over the last decade in the five most affected regions?* *Which countries have early warning data but no active emergency declaration, indicating a potential pre-crisis situation?* |

| UC-05  Cross-Domain Federated Analysis |
| :---- |
| **Humanitarian need:**  Senior analysts and inter-agency working groups need to combine data across multiple domains, emergency, funding, population, needs, without commissioning bespoke data engineering for each question. **How the model helps:**  The shared domain structure, common identifiers (particularly location and emergency identifiers from Reference Data domains), and standardised metadata make federated queries possible across all five organisations' datasets. **Illustrative queries:** *For countries with active Level 3 emergencies: how do funding levels, population displacement figures, and food security severity scores compare?* *Which protracted crises have declining funding trends but stable or increasing displacement figures?* *Across all active appeals, what proportion of targeted populations are in areas also flagged as high-risk by the Risk Management domain?* |

| *Stress-testing is not a technical exercise, it is a governance exercise. The purpose is to surface ambiguities in domain definitions and resolve them through agreed decisions before data is published against the model. Results of stress-testing must be documented and, where they lead to definition changes, processed through the decision-making process in Section 4\.* |
| :---- |

### **7.4.1  Known Boundary Cases**

The following domain boundary questions were raised during the review process and are documented here pending formal resolution through stress-testing:

| Question | Candidate domains | Interim position |
| :---- | :---- | :---- |
| Where does conflict data sit — as a Hazardous Event, within Emergencies & Situation Definitions, or in a separate domain? | Hazardous Events; Emergencies & Situation Definitions | Conflict data listed as an example dataset in Hazardous Events. Formal decision deferred to stress-test. |
| Should healthcare access and education data be standalone domains or distributed across existing domains? | Situation Analysis and Needs; Infrastructure; Population Domain | Working group consensus: these are thematic lenses, not standalone domains. Data distributed across existing domains by subject (e.g. facility location in Infrastructure, access barriers in Situation Analysis). |
| Conflict and political instability as a Situation Analysis subdomain — or covered by existing domains? | Situation Analysis and Needs; Hazardous Events; Protection & Legal | Flagged as TBC. Interim position: covered across existing domains. Formal decision pending. |
| Where do market assessments belong — Situation Analysis (as a needs driver) or a standalone Market Systems domain? | Situation Analysis and Needs (Market Systems subdomain); standalone domain | Currently nested as a Situation Analysis subdomain (Not MVP). Decision to remain pending Phase 2 scoping. |

