'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PreferencesExplainer() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Info className="h-4 w-4" />
        <span>What are preferences?</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-4 bg-muted/50 rounded-lg text-sm space-y-3">
              <p>
                Preferences help Meetly understand your scheduling style and
                meeting preferences. They guide how we:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Choose the best times for your meetings</li>
                <li>Suggest ideal locations for in-person meetups</li>
                <li>Respect your productivity patterns and focus time</li>
                <li>Match venues to your personal style and needs</li>
              </ul>
              <p className="text-muted-foreground">
                Be as specific as you like! The more context you provide, the
                better Meetly can tailor scheduling to your lifestyle.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
