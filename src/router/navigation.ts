// Route names and section IDs shared by the sidebar and route metadata.
export const navigationGroups = [
  {
    label: 'Workspace',
    items: [
      { section: 'home', routeName: 'pages-home', label: 'Home' },
      { section: 'space', routeName: 'space-apps-list', label: 'Personal Space' },
    ],
  },
  {
    label: 'Explore',
    items: [
      { section: 'apps', routeName: 'store-apps-list', label: 'App Marketplace' },
      { section: 'tools', routeName: 'store-tools-list', label: 'Tool Marketplace' },
      { section: 'open', routeName: 'open-api', label: 'Open API' },
    ],
  },
] as const

export type NavigationSection = (typeof navigationGroups)[number]['items'][number]['section']
export const sidebarActions = {
  home: { name: 'pages-home' },
  createApp: { name: 'space-apps-create' },
  account: { name: 'account-settings' },
} as const
