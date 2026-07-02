import { describe, it, expect } from 'vitest';
import { serviceJobSchema } from './validationSchema';

describe('serviceJobSchema Validation Tests', () => {
  it('should validate a correct payload successfully', () => {
    const validData = {
      customerName: 'John Doe',
      mobileNumber: '9876543210',
      deviceType: 'Mobile',
      brand: 'Samsung',
      model: 'Galaxy S21',
      complaint: 'Screen is cracked',
      technicianAssigned: 'Suresh',
      status: 'Received',
      estimatedAmount: 5000,
      billedBy: 'Admin'
    };

    const result = serviceJobSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should fail if mobile number is not 10 digits', () => {
    const invalidData = {
      customerName: 'John Doe',
      mobileNumber: '987654321', // 9 digits
      deviceType: 'Mobile',
      brand: 'Samsung',
      model: 'Galaxy S21',
      complaint: 'Screen is cracked',
      technicianAssigned: 'Suresh',
      status: 'Received',
      estimatedAmount: 5000,
      billedBy: 'Admin'
    };

    const result = serviceJobSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Mobile number must be exactly 10 digits");
    }
  });

  it('should enforce conditional validation for returned devices', () => {
    const returnedData = {
      customerName: 'John Doe',
      mobileNumber: '9876543210',
      deviceType: 'Mobile',
      brand: 'Samsung',
      model: 'Galaxy S21',
      complaint: 'Screen is cracked',
      technicianAssigned: 'Suresh',
      status: 'Returned', // Status is returned but no reason provided
      estimatedAmount: 5000,
      billedBy: 'Admin'
    };

    const result = serviceJobSchema.safeParse(returnedData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const returnReasonError = result.error.issues.find(issue => issue.path.includes("returnReason"));
      expect(returnReasonError).toBeDefined();
    }
  });
});
