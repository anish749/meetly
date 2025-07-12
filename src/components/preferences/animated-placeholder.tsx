'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const placeholderTexts = [
  "Keep my mornings free if I'm not traveling. I'm most productive before noon and prefer to have uninterrupted focus time.",
  'If meeting someone in my city, suggest a nice cafe in between us. I enjoy places with good ambiance and quality coffee.',
  'Prefer places with a young crowd and good coffee or beer selection. Bonus points for venues with outdoor seating.',
  'Schedule meetings after 2 PM on Mondays. I use Monday mornings for weekly planning and catching up on emails.',
  'Avoid scheduling during my focus time (9 AM - 12 PM). This is when I do my best deep work.',
  'For evening meetings, suggest venues with parking nearby. I prefer not to worry about finding parking after dark.',
];

interface AnimatedPlaceholderProps {
  isActive: boolean;
}

export function AnimatedPlaceholder({ isActive }: AnimatedPlaceholderProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % placeholderTexts.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={currentIndex}
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 0.5, y: 0 }}
        exit={{ opacity: 0, y: -5 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0 flex items-start p-3 pointer-events-none"
      >
        <span className="text-sm text-muted-foreground">
          {placeholderTexts[currentIndex]}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
