// Sample ICP the demo scores against. Swap these values to retarget the demo.
export const ICP = {
  name: "Sample ICP: B2B SaaS selling to revenue teams",
  industry: "B2B SaaS",
  employees: { min: 11, max: 200 },
  buyer: "sales and marketing teams",
  geography: "United States",
  description:
    "US-based B2B SaaS companies with 11-200 employees whose product is sold to " +
    "sales or marketing teams. Strong signals: outbound or PLG sales motion, " +
    "recent funding, active GTM hiring, revenue-tooling ecosystem presence.",
} as const;

export type Icp = typeof ICP;
