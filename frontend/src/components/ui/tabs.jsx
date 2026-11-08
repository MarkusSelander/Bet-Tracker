import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-9 items-center justify-center rounded-lg border border-hairline bg-sunken p-0.5 text-text-secondary',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex h-7 items-center justify-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium transition-colors duration-150 hover:text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/70 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-elevated data-[state=active]:text-text-primary data-[state=active]:shadow-[0_1px_0_0_rgb(255_255_255/0.04)_inset,0_1px_2px_rgb(0_0_0/0.4)]',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/60 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-200',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
