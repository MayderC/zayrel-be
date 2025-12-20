export interface IPaymentStorageService {
    /**
     * Stores a payment proof and returns the URL or path to access it.
     * @param fileBase64 The file content in Base64 (or buffer if extended later)
     * @param orderId Optional order ID for organization
     */
    store(fileBase64: string, orderId?: string): Promise<string>;
}
