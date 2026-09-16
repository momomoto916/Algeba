import { Suspense } from 'react';
import { Genesis } from '../components/Genesis';

export function GenesisPage() {
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Genesis Event</h1>
        <p className="page-subtitle">Participate in the fair-launch allocation and claim your share</p>
      </div>

      <section className="py-2.5 px-2">
        <Suspense fallback={<div className="animate-pulse bg-gray-200 h-96 rounded-lg"></div>}>
          <Genesis />
        </Suspense>
      </section>
    </>
  );
}
