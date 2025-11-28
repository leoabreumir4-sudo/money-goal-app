# Spending Page Cleanup - Remove Recurring Expenses

## Changes Made:
1. Remove all recurring expense related state variables
2. Remove recurring expense tRPC queries and mutations  
3. Remove recurring expense UI components and modals
4. Remove recurring expense calculations from charts
5. Clean up imports and unused code
6. Keep only core spending/transaction functionality

## Kept Features:
- Transaction management
- Category-based expense tracking
- Pie chart visualization  
- Period filtering
- Transaction adding/editing

## Removed Features:
- Recurring expense creation/editing
- Recurring expense summary cards
- Recurring expense modals
- Monthly recurring calculations
- Useless hardcoded insights section

This simplifies the page and removes redundancy with Bills feature.