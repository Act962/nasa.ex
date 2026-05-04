export type IntegrationStatus = 'installed' | 'available' | 'view_only'

export type IntegrationCategory =
  | 'messengers'
  | 'whatsapp_providers'
  | 'live_chat'
  | 'forms'
  | 'ecommerce'
  | 'industry'
  | 'chatbots'
  | 'calls'
  | 'marketing'
  | 'payments'
  | 'integration_services'
  | 'workflow'
  | 'analytics'
  | 'documents'
  | 'lead_customization'
  | 'productivity'
  | 'field_customization'
  | 'duplicate_management'
  | 'crm_customization'

export interface CredentialField {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder: string
  helpText: string
  helpUrl?: string
  required: boolean
}

export interface Integration {
  id: string
  slug: string
  name: string
  description: string
  category: IntegrationCategory
  status: IntegrationStatus
  icon: string            // URL (favicon/clearbit) ou emoji fallback
  tags: string[]
  connectUrl?: string
  hubPageEnabled: boolean
  spaceImagePrompt?: string
  credentials?: CredentialField[]  // Campos de configuração da integração
  oauthProvider?: 'meta' | 'google'  // Conexão via OAuth wizard
  manualFallback?: boolean           // Habilita modo manual paste como fallback
}

export const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  messengers: 'Mensageiros',
  whatsapp_providers: 'Provedores WhatsApp',
  live_chat: 'Chat ao Vivo',
  forms: 'Formulários',
  ecommerce: 'E-commerce',
  industry: 'Segmentos',
  chatbots: 'Chatbots',
  calls: 'Ligações',
  marketing: 'Marketing',
  payments: 'Pagamentos',
  integration_services: 'Integrações',
  workflow: 'Workflow',
  analytics: 'Análises',
  documents: 'Documentos',
  lead_customization: 'Captação de Leads',
  productivity: 'Produtividade',
  field_customization: 'Campos Personalizados',
  duplicate_management: 'Gestão de Duplicatas',
  crm_customization: 'CRM & Vendas',
}

export const CATEGORY_ICONS: Record<IntegrationCategory, string> = {
  messengers: '💬',
  whatsapp_providers: '📱',
  live_chat: '🗨️',
  forms: '📋',
  ecommerce: '🛒',
  industry: '🏭',
  chatbots: '🤖',
  calls: '📞',
  marketing: '📣',
  payments: '💳',
  integration_services: '🔌',
  workflow: '⚙️',
  analytics: '📊',
  documents: '📄',
  lead_customization: '🎯',
  productivity: '⚡',
  field_customization: '🔧',
  duplicate_management: '🔍',
  crm_customization: '🏆',
}
