'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { getStoredSession } from '../lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    if (getStoredSession()) {
      router.replace('/dashboard');
      return;
    }

    router.replace('/login');
  }, [router]);

  return null;
}
