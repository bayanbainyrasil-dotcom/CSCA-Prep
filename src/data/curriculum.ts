export const mathTopics = [
  'Foundation', 'Sets', 'Inequalities', 'Functions', 'Exponents', 'Logarithms', 'Trigonometry',
  'Sequences', 'Derivatives', 'Coordinate geometry', 'Circles', 'Parabola', 'Ellipse', 'Hyperbola',
  'Vectors', 'Complex numbers', '3D geometry', 'Probability', 'Statistics',
] as const;

export const physicsTopics = [
  'Foundation', 'Units & SI', 'Scientific notation', 'Vectors', 'Graph reading', 'Kinematics',
  'Acceleration', 'Free fall', 'Newton’s laws', 'Friction', 'Work', 'Energy', 'Momentum',
  'Circular motion', 'Gravitation', 'Oscillations', 'Waves', 'Electrostatics', 'Electric field',
  'Potential', 'Current', 'Ohm’s law', 'Circuits', 'Magnetic field', 'Lorentz force', 'Ampere force',
  'Electromagnetic induction', 'Faraday’s law', 'Lenz’s law', 'Thermodynamics', 'Optics',
  'Photoelectric effect', 'Atomic physics', 'Nuclear physics',
] as const;

export const roadmapWeeks = [
  { week: 1, math: 'Arithmetic reset', physics: 'Units & SI', focus: 'Read values and units' },
  { week: 2, math: 'Algebra foundations', physics: 'Vectors & graphs', focus: 'Translate words into quantities' },
  { week: 3, math: 'Functions', physics: 'Kinematics', focus: 'Connect graphs and motion' },
  { week: 4, math: 'Quadratics', physics: 'Newton’s laws', focus: 'Build solution chains' },
  { week: 5, math: 'Exponents & logs', physics: 'Work & energy', focus: 'Choose the right model' },
  { week: 6, math: 'Trigonometry', physics: 'Momentum', focus: 'Resolve components' },
  { week: 7, math: 'Sequences', physics: 'Circular motion', focus: 'Spot repeated structure' },
  { week: 8, math: 'Derivatives', physics: 'Waves', focus: 'Interpret rates of change' },
  { week: 9, math: 'Coordinate geometry', physics: 'Electricity', focus: 'Draw before calculating' },
  { week: 10, math: 'Conics & vectors', physics: 'Magnetism', focus: 'Control signs and direction' },
  { week: 11, math: 'Probability & statistics', physics: 'Thermal & optics', focus: 'Mixed-topic speed' },
  { week: 12, math: 'Full review', physics: 'Modern physics', focus: 'Mock exams & repair' },
] as const;
