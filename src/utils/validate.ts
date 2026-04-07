// src/utils/validate.ts
// Helper functions dùng chung cho việc validate dữ liệu đầu vào
// Tách riêng để tái sử dụng ở nhiều controller

/**
 * Kiểm tra ID có hợp lệ không
 *
 * Quy tắc:
 * - Phải là chuỗi chỉ chứa chữ số (0-9)
 * - Phải là số nguyên dương (> 0)
 *
 * @param id - Chuỗi ID từ URL params (VD: "1", "abc", "-5")
 * @returns true nếu ID hợp lệ, false nếu không
 *
 * VD:
 *   isValidId("1")   → true
 *   isValidId("123") → true
 *   isValidId("0")   → false (không dương)
 *   isValidId("abc") → false (không phải số)
 *   isValidId("-5")  → false (có dấu trừ)
 */
export function isValidId(id: string): boolean {
  // Regex ^\d+$ chỉ cho phép chuỗi toàn chữ số
  if (!/^\d+$/.test(id)) return false;

  // Chuyển sang số và kiểm tra > 0
  return Number(id) > 0;
}

/**
 * Kiểm tra body request có rỗng không
 *
 * Khi client gửi POST/PUT/PATCH mà body = {} hoặc không gửi gì
 * → không có dữ liệu để xử lý → trả về lỗi 400
 *
 * @param body - Object body từ request (đã được express.json() parse)
 * @returns true nếu body rỗng (không có field nào), false nếu có dữ liệu
 *
 * VD:
 *   isEmptyBody({})                    → true  (rỗng)
 *   isEmptyBody({ title: "Hello" })    → false (có dữ liệu)
 */
export function isEmptyBody(body: Record<string, unknown>): boolean {
  return Object.keys(body).length === 0;
}
