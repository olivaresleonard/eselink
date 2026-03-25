export interface ListingPublisher {
  supports(channelCode: string): boolean;

  importExistingListings(input: {
    workspaceId: string;
    accountId: string;
  }): Promise<{
    importedCount: number;
    imported: Array<Record<string, unknown>>;
  }>;
}
