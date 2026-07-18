// Seed data for SkillCard. All in-memory, deterministic. No DB, no setup flow.
// Robots, Tasks, and a Marketplace of purchasable skills.

export const ACCOUNTING_CATEGORIES = {
  perception: 'Software / Perception Licensing',
  manipulation: 'Software / Robotics Capability',
  teleop: 'Contract Labor / Teleoperation',
  navigation: 'Software / Autonomy Licensing',
};

// ---------------------------------------------------------------------------
// Robots — each has a virtual card (budget), spend to date, and a spend policy.
// ---------------------------------------------------------------------------
export function seedRobots() {
  return [
    {
      id: 'rbt-01',
      name: 'Atlas-7',
      model: 'Boston Dynamics Atlas (sim)',
      monthlyBudget: 2000,
      spent: 340,
      policy: {
        autoApproveCeiling: 50, // per-transaction auto-approve ceiling in USD
        blockedCategories: ['teleop'], // fully autonomous unit — no human teleop allowed
        requiredCertifications: ['SOC2'],
      },
      capabilities: ['navigation', 'object-detection', 'path-planning'],
      history: [
        { label: 'Depth Perception Pro', amount: 120, ts: '2026-07-02' },
        { label: 'Grasp Planner Lite', amount: 220, ts: '2026-07-09' },
      ],
      tasksCompleted: 2,
    },
    {
      id: 'rbt-02',
      name: 'Spot-Delta',
      model: 'Quadruped Inspector (sim)',
      monthlyBudget: 1200,
      spent: 180,
      policy: {
        autoApproveCeiling: 120,
        blockedCategories: [],
        requiredCertifications: [],
      },
      capabilities: ['navigation', 'thermal-imaging'],
      history: [{ label: 'Thermal Anomaly Detect', amount: 180, ts: '2026-07-05' }],
      tasksCompleted: 1,
    },
    {
      id: 'rbt-03',
      name: 'Arm-Nova',
      model: 'Fixed-Base 6DOF Arm (sim)',
      monthlyBudget: 800,
      spent: 95,
      policy: {
        autoApproveCeiling: 75,
        blockedCategories: [],
        requiredCertifications: ['SOC2'],
      },
      capabilities: ['object-detection', 'precision-grasp'],
      history: [{ label: 'Bin Pick Vision', amount: 95, ts: '2026-07-11' }],
      tasksCompleted: 1,
    },
  ];
}

// ---------------------------------------------------------------------------
// Tasks — a queue of jobs. Each requires a capability the robot may lack.
// ---------------------------------------------------------------------------
export function seedTasks() {
  return [
    {
      id: 'task-01',
      description: 'Pick a transparent glass beaker from a cluttered lab bench and place it in the rack',
      requiredCapability: 'transparent-object-grasp',
      taskValue: 480, // what completing it is worth to the business
      humanBaselineCost: 220, // what a person would charge to do it
      difficulty: 'High',
    },
    {
      id: 'task-02',
      description: 'Read and verify a damaged shipping label under low warehouse light',
      requiredCapability: 'ocr-lowlight',
      taskValue: 150,
      humanBaselineCost: 90,
      difficulty: 'Medium',
    },
    {
      id: 'task-03',
      description: 'Inspect a weld seam on a pressure vessel and flag micro-fractures',
      requiredCapability: 'weld-inspection',
      taskValue: 900,
      humanBaselineCost: 650,
      difficulty: 'High',
    },
    {
      id: 'task-04',
      description: 'Sort mixed recycling on a moving conveyor by material type',
      requiredCapability: 'material-classification',
      taskValue: 300,
      humanBaselineCost: 140,
      difficulty: 'Medium',
    },
    {
      id: 'task-05',
      description: 'Navigate a flooded basement corridor and map safe egress routes',
      requiredCapability: 'flood-navigation',
      taskValue: 620,
      humanBaselineCost: 400,
      difficulty: 'High',
    },
  ];
}

// ---------------------------------------------------------------------------
// Marketplace — purchasable skills. Includes a deliberately expensive option,
// a cheap option, a human teleoperator, and one needing hardware a robot lacks.
// ---------------------------------------------------------------------------
export function seedMarketplace() {
  return [
    // --- transparent-object-grasp candidates ---
    {
      id: 'skl-01',
      name: 'ClearGrasp Neural Depth',
      vendor: 'RefractionAI',
      price: 42,
      pricingModel: 'per execution',
      capability: 'transparent-object-grasp',
      successRate: 0.94,
      requiredHardware: [],
      certifications: ['SOC2'],
      category: 'perception',
    },
    {
      id: 'skl-02',
      name: 'Photon LiDAR Grasp Suite',
      vendor: 'DepthWorks',
      price: 380,
      pricingModel: 'per execution',
      capability: 'transparent-object-grasp',
      successRate: 0.97,
      requiredHardware: ['lidar-array'], // Atlas-7 does NOT have this -> policy reject
      certifications: ['SOC2'],
      category: 'perception',
    },
    {
      id: 'skl-03',
      name: 'Human Teleop On-Demand',
      vendor: 'HandsOn Robotics',
      price: 55,
      pricingModel: 'per minute',
      capability: 'transparent-object-grasp',
      successRate: 0.99,
      requiredHardware: [],
      certifications: [],
      category: 'teleop', // blocked for autonomous units by policy
    },
    {
      id: 'skl-04',
      name: 'GraspGen Budget Vision',
      vendor: 'PickPix',
      price: 18,
      pricingModel: 'per execution',
      capability: 'transparent-object-grasp',
      successRate: 0.72,
      requiredHardware: [],
      certifications: ['SOC2'],
      category: 'manipulation',
    },
    // --- ocr-lowlight ---
    {
      id: 'skl-05',
      name: 'NightRead OCR',
      vendor: 'LumenText',
      price: 12,
      pricingModel: 'per image',
      capability: 'ocr-lowlight',
      successRate: 0.91,
      requiredHardware: [],
      certifications: ['SOC2'],
      category: 'perception',
    },
    {
      id: 'skl-06',
      name: 'Human Label Verify',
      vendor: 'HandsOn Robotics',
      price: 85,
      pricingModel: 'per minute',
      capability: 'ocr-lowlight',
      successRate: 0.995,
      requiredHardware: [],
      certifications: [],
      category: 'teleop',
    },
    // --- weld-inspection ---
    {
      id: 'skl-07',
      name: 'SeamScan X-Ray Vision',
      vendor: 'NDT Systems',
      price: 210,
      pricingModel: 'per execution',
      capability: 'weld-inspection',
      successRate: 0.96,
      requiredHardware: [],
      certifications: ['SOC2'],
      category: 'perception',
    },
    // --- material-classification ---
    {
      id: 'skl-08',
      name: 'SortNet Spectral',
      vendor: 'WasteAI',
      price: 34,
      pricingModel: 'per minute',
      capability: 'material-classification',
      successRate: 0.89,
      requiredHardware: [],
      certifications: ['SOC2'],
      category: 'perception',
    },
  ];
}
