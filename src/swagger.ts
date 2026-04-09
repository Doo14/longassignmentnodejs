
// Truy cập tại: http://localhost:3000/api-docs

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';


const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Smart API Hub',
      version: '2.0.0',
      description:
        'REST API Platform tự động sinh API từ file schema.json. Hỗ trợ Dynamic CRUD, Advanced Query, Auth, Rate Limiting, Caching, Audit Logging.',
      contact: {
        name: 'Developer',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token từ /auth/login',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        AuthRegister: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'password123',
            },
            name: { type: 'string', example: 'Nguyen Van A' },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              default: 'user',
            },
            age: { type: 'number', example: 25 },
          },
        },
        AuthLogin: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'user@example.com',
            },
            password: { type: 'string', example: 'password123' },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            token: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'number' },
                email: { type: 'string' },
                name: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Kiểm tra trạng thái server và kết nối database',
          responses: {
            '200': {
              description: 'Server hoạt động bình thường',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      uptime: { type: 'number' },
                      database: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', example: 'connected' },
                        },
                      },
                    },
                  },
                },
              },
            },
            '503': {
              description: 'Database không kết nối được',
            },
          },
        },
      },
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Đăng ký tài khoản',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthRegister' },
              },
            },
          },
          responses: {
            '201': { description: 'Đăng ký thành công' },
            '400': {
              description: 'Dữ liệu không hợp lệ',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ValidationError' },
                },
              },
            },
            '409': { description: 'Email đã được sử dụng' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Đăng nhập & nhận JWT',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AuthLogin' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Đăng nhập thành công',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' },
                },
              },
            },
            '401': { description: 'Email hoặc password không đúng' },
          },
        },
      },
      '/{resource}': {
        get: {
          tags: ['Dynamic CRUD'],
          summary: 'Lấy tất cả records',
          description:
            'Hỗ trợ: _fields, _page, _limit, _sort, _order, filters, operators (_gte, _lte, _ne, _like), search (?q=), _expand, _embed',
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'posts',
            },
            {
              name: '_fields',
              in: 'query',
              schema: { type: 'string' },
              example: 'id,title',
            },
            {
              name: '_page',
              in: 'query',
              schema: { type: 'integer' },
              example: 1,
            },
            {
              name: '_limit',
              in: 'query',
              schema: { type: 'integer' },
              example: 10,
            },
            {
              name: '_sort',
              in: 'query',
              schema: { type: 'string' },
              example: 'views',
            },
            {
              name: '_order',
              in: 'query',
              schema: { type: 'string', enum: ['asc', 'desc'] },
            },
            {
              name: 'q',
              in: 'query',
              schema: { type: 'string' },
              description: 'Full-text search',
            },
            {
              name: '_expand',
              in: 'query',
              schema: { type: 'string' },
              example: 'user',
            },
            {
              name: '_embed',
              in: 'query',
              schema: { type: 'string' },
              example: 'comments',
            },
          ],
          responses: {
            '200': { description: 'Danh sách records' },
            '404': { description: 'Resource không tồn tại' },
          },
        },
        post: {
          tags: ['Dynamic CRUD'],
          summary: 'Tạo mới record',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'posts',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
          responses: {
            '201': { description: 'Tạo thành công' },
            '400': { description: 'Dữ liệu không hợp lệ' },
            '401': { description: 'Chưa đăng nhập' },
          },
        },
      },
      '/{resource}/{id}': {
        get: {
          tags: ['Dynamic CRUD'],
          summary: 'Lấy 1 record theo ID',
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            '200': { description: 'Record tìm thấy' },
            '404': { description: 'Không tìm thấy' },
          },
        },
        put: {
          tags: ['Dynamic CRUD'],
          summary: 'Cập nhật toàn bộ record',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: {
            '200': { description: 'Cập nhật thành công' },
            '401': { description: 'Chưa đăng nhập' },
            '404': { description: 'Không tìm thấy' },
          },
        },
        patch: {
          tags: ['Dynamic CRUD'],
          summary: 'Cập nhật 1 phần record',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object' } } },
          },
          responses: {
            '200': { description: 'Cập nhật thành công' },
            '401': { description: 'Chưa đăng nhập' },
            '404': { description: 'Không tìm thấy' },
          },
        },
        delete: {
          tags: ['Dynamic CRUD'],
          summary: 'Xóa record (admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
            },
          ],
          responses: {
            '204': { description: 'Xóa thành công' },
            '401': { description: 'Chưa đăng nhập' },
            '403': { description: 'Không có quyền (chỉ admin)' },
            '404': { description: 'Không tìm thấy' },
          },
        },
      },
      '/{resource}/{id}/{child}': {
        get: {
          tags: ['Relationships'],
          summary: 'Lấy nested children',
          description: 'VD: GET /posts/1/comments → comments của post id=1',
          parameters: [
            {
              name: 'resource',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'posts',
            },
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              example: 1,
            },
            {
              name: 'child',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              example: 'comments',
            },
          ],
          responses: {
            '200': { description: 'Danh sách children' },
            '404': { description: 'Resource hoặc parent không tồn tại' },
          },
        },
      },
    },
  },
  apis: [], // Không dùng JSDoc annotations — spec đã inline ở trên
});

/**
 * Setup Swagger UI endpoint
 * Truy cập: http://localhost:3000/api-docs
 */
export function setupSwagger(app: Express): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Smart API Hub — API Docs',
  }));

  // Endpoint trả về raw JSON spec (cho Postman import)
  app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerSpec);
  });
}
