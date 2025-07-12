import { Metadata } from 'next';
import { StinaDashboard } from '@/components/stina/stina-dashboard';

export const metadata: Metadata = {
  title: 'Stina AI Agent - Meetly',
  description: 'Your intelligent executive assistant for meeting scheduling',
};

export default function StinaPage() {
  return (
    <div className="container mx-auto py-8">
      <StinaDashboard />
    </div>
  );
}