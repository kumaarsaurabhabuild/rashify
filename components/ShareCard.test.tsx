import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareCard } from './ShareCard';

const archetype = {
  label: 'The Saturn-Mercury Strategist',
  sanskritLabel: 'Karma-Yoga Tantri',
  coreTraits: ['Patient architect', 'Quiet authority', 'Slow ambition'],
  strengths: ['Strategy', 'Patience', 'Discipline'],
  growthEdges: ['Letting go', 'Spontaneity'],
  luckyColor: 'indigo',
  luckyNumber: 7,
  powerWindow: '10:30 PM - 2 AM',
  oneLiner: 'A patient architect of slow ambition.',
  provenance: { ayanamsa: 'Lahiri', system: 'Vedic sidereal', nakshatra: 'Anuradha', lagna: 'Vrishabha', currentDasha: 'Saturn-Venus' },
};

describe('ShareCard', () => {
  it('renders archetype label, sanskrit label and traits', () => {
    render(<ShareCard archetype={archetype} slug="saurabh-x7k2" appUrl="https://rashify.in" />);
    expect(screen.getByText(archetype.label)).toBeInTheDocument();
    expect(screen.getByText(archetype.sanskritLabel)).toBeInTheDocument();
    archetype.coreTraits.forEach((t) => expect(screen.getByText(t)).toBeInTheDocument());
  });

  it('renders viral framing — eyebrow + oneLiner', () => {
    render(<ShareCard archetype={archetype} slug="x" appUrl="https://rashify.in" />);
    expect(screen.getByText(/VEDIC ARCHETYPE/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(archetype.oneLiner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
  });
});
