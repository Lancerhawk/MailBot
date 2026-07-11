'use client';
import { useEffect } from 'react';
import { Vyzora } from 'vyzora-sdk';

export default function VyzoraProvider() {
    useEffect(() => {
        new Vyzora({
            apiKey: process.env.NEXT_PUBLIC_VYZORA_KEY!,
            enabled: process.env.NEXT_PUBLIC_VYZORA_ENABLED === 'true',
        });
    }, []);
    return null;
}