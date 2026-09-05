export type AssistanceType = 'WATER' | 'WAITER' | 'UTENSILS' | 'BILL_OUT' | 'OTHER'

export interface AssistanceRequest {
  id: string
  tableId: number
  tableNum?: number
  type: AssistanceType
  title: string
  notes?: string
  status: 'PENDING' | 'RESOLVED'
  requestedAt: string
}

export const ASSISTANCE_OPTIONS: {
  type: AssistanceType
  title: string
  description: string
  icon: string
}[] = [
  {
    type: 'WATER',
    title: 'Ask for Water',
    description: 'Request a pitcher of iced water or cup refills',
    icon: 'Droplets',
  },
  {
    type: 'WAITER',
    title: 'Call a Waiter',
    description: 'Request table service or ask the staff a question',
    icon: 'UserCheck',
  },
  {
    type: 'UTENSILS',
    title: 'Utensils or Napkins',
    description: 'Extra spoons, forks, knives, napkins, or condiment sauces',
    icon: 'UtensilsCrossed',
  },
  {
    type: 'BILL_OUT',
    title: 'Ask for Bill Out',
    description: 'Request the final bill and choose your payment method',
    icon: 'Receipt',
  },
  {
    type: 'OTHER',
    title: 'Other Request',
    description: 'Custom inquiry or special assistance for your table',
    icon: 'MessageSquare',
  },
]
