/**
 * Seed data cho KioskAI — chạy 1 lần sau migration.
 *  - statuses: 8 trạng thái hồ sơ chuẩn
 *  - citizen_services: 3 dịch vụ cấp 1 (Cư trú, Hộ chiếu, CCCD)
 *  - procedures: 6 thủ tục con (thường trú/tạm trú/tạm vắng/lưu trú/gia hạn/xoá)
 *  - procedure_form_versions: version 1 với form_schema + required_docs rỗng
 *    (frontend hiện đang hardcode, sẽ fill sau)
 *
 * Chạy: npm run db:seed --workspace=server
 * Idempotent: dùng onConflictDoNothing để chạy lại không lỗi.
 */
import 'dotenv/config';
import { db, sql } from './index.js';
import {
  statuses,
  citizenServices,
  procedures,
  procedureFormVersions,
} from './schema.js';

export async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Statuses
  const statusSeed = [
    { code: 'draft', name: 'Bản nháp', color: '#94a3b8', displayOrder: 1, isTerminal: false, description: 'Hồ sơ đang được người dân lưu nháp, chưa nộp' },
    { code: 'submitted', name: 'Đã nộp', color: '#2563eb', displayOrder: 2, isTerminal: false, description: 'Hồ sơ đã nộp lên hệ thống, chờ gửi BCA' },
    { code: 'sent_to_ca', name: 'Đã gửi BCA', color: '#0ea5e9', displayOrder: 3, isTerminal: false, description: 'Hệ thống đã forward hồ sơ sang Bộ Công An' },
    { code: 'received_by_ca', name: 'BCA đã nhận', color: '#8b5cf6', displayOrder: 4, isTerminal: false, description: 'BCA xác nhận đã nhận hồ sơ' },
    { code: 'processing', name: 'Đang xử lý', color: '#f59e0b', displayOrder: 5, isTerminal: false, description: 'BCA đang xử lý hồ sơ' },
    { code: 'approved', name: 'Đã duyệt', color: '#22c55e', displayOrder: 6, isTerminal: true, description: 'BCA đã phê duyệt hồ sơ' },
    { code: 'rejected', name: 'Bị từ chối', color: '#ef4444', displayOrder: 7, isTerminal: true, description: 'BCA từ chối hồ sơ (xem reason)' },
    { code: 'cancelled', name: 'Đã hủy', color: '#64748b', displayOrder: 8, isTerminal: true, description: 'Người dân/hệ thống hủy hồ sơ' },
  ];
  const insertedStatuses = await db
    .insert(statuses)
    .values(statusSeed)
    .onConflictDoNothing({ target: statuses.code })
    .returning();
  console.log(`  ✓ statuses: ${insertedStatuses.length} inserted / ${statusSeed.length} total`);

  // 2. Citizen services (cấp 1)
  const serviceSeed = [
    { code: 'cu-tru', name: 'Cư trú', description: 'Đăng ký cư trú, tạm trú, tạm vắng, lưu trú...', icon: '/assets/icon-cu-tru.svg', displayOrder: 1 },
    { code: 'ho-chieu', name: 'Hộ chiếu', description: 'Cấp mới, cấp đổi, gia hạn hộ chiếu', icon: '/assets/icon-ho-chieu.svg', displayOrder: 2 },
    { code: 'cccd', name: 'Căn cước công dân', description: 'Cấp mới, cấp đổi căn cước công dân', icon: '/assets/icon-cccd.svg', displayOrder: 3 },
  ];
  const insertedServices = await db
    .insert(citizenServices)
    .values(serviceSeed)
    .onConflictDoNothing({ target: citizenServices.code })
    .returning();
  console.log(`  ✓ citizen_services: ${insertedServices.length} inserted / ${serviceSeed.length} total`);

  // Lấy lại services (để ref bằng id khi insert procedures)
  const allServices = await db.select().from(citizenServices);
  const serviceByCode = new Map(allServices.map((s) => [s.code, s.id]));
  const cuTruId = serviceByCode.get('cu-tru')!;

  // 3. Procedures (thủ tục con)
  const procedureSeed = [
    { serviceId: cuTruId, code: 'thuong-tru', name: 'Đăng ký thường trú', description: 'Đăng ký nơi ở ổn định lâu dài', processingDays: 15 },
    { serviceId: cuTruId, code: 'tam-tru', name: 'Đăng ký tạm trú', description: 'Đăng ký nơi ở tạm thời', processingDays: 3 },
    { serviceId: cuTruId, code: 'tam-vang', name: 'Khai báo tạm vắng', description: 'Khai báo không có mặt tại nơi cư trú', processingDays: 1 },
    { serviceId: cuTruId, code: 'luu-tru', name: 'Thông báo lưu trú', description: 'Thông báo người lưu trú ngắn hạn', processingDays: 1 },
    { serviceId: cuTruId, code: 'gia-han-tam-tru', name: 'Gia hạn tạm trú', description: 'Gia hạn thời hạn tạm trú', processingDays: 3 },
    { serviceId: cuTruId, code: 'xoa-dang-ky', name: 'Xoá đăng ký tạm trú', description: 'Xoá đăng ký nơi tạm trú hiện tại', processingDays: 5 },
  ];
  const insertedProcedures = await db
    .insert(procedures)
    .values(procedureSeed)
    .onConflictDoNothing({ target: procedures.code })
    .returning();
  console.log(`  ✓ procedures: ${insertedProcedures.length} inserted / ${procedureSeed.length} total`);

  // 4. Procedure form versions (version 1)
  // required_docs chứa recognition config cho OCR classifier
  const allProcedures = await db.select().from(procedures);
  const procedureByCode = new Map(allProcedures.map((p) => [p.code, p]));

  const REQUIRED_DOCS_BY_CODE: Record<string, { documents: unknown[] }> = {
    'tam-vang': {
      documents: [
        {
          code: 'ct03-phieu-tam-vang',
          name: 'Phiếu khai báo tạm vắng (Mẫu CT03)',
          required: true,
          templateUrl: '/assets/mauct03khaibaotamvang.svg',
          recognition: {
            mustHave: ['phiếu khai báo tạm vắng'],
            shouldHave: ['ct03', 'số phiếu', 'họ và tên', 'công an'],
            minScore: 0.4,
          },
        },
        {
          code: 'van-ban-dong-y-giam-sat-giao-duc',
          name: 'Văn bản đồng ý của cơ quan có thẩm quyền giám sát, quản lý, giáo dục',
          required: false,
          requiredWhen: { branch: 'giao-duc-tu-phap' },
          templateUrl: '/assets/mau-van-ban-dong-y-giam-sat-giao-duc.doc',
          recognition: {
            mustHave: ['văn bản đồng ý', 'giám sát'],
            shouldHave: ['cơ quan', 'thẩm quyền', 'quản lý', 'giáo dục'],
            minScore: 0.5,
          },
        },
        {
          code: 'giay-cham-soc-nuoi-duong',
          name: 'Giấy tờ xác nhận việc chăm sóc/nuôi dưỡng',
          required: false,
          requiredWhen: { branch: 'tre-em-khuyet-tat' },
          recognition: {
            mustHave: ['chăm sóc'],
            shouldHave: ['nuôi dưỡng', 'xác nhận', 'ubnd'],
            minScore: 0.4,
          },
        },
      ],
    },
    'thuong-tru': {
      documents: [
        {
          code: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
          name: 'Tờ khai thay đổi thông tin cư trú (Mẫu CT01)',
          required: true,
          templateUrl: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
          recognition: {
            mustHave: ['tờ khai', 'thông tin cư trú'],
            shouldHave: [
              'ct01',
              'thay đổi',
              'họ chữ đệm',
              'ngày tháng năm sinh',
              'cộng hòa xã hội',
              'độc lập',
            ],
            minScore: 0.4,
          },
        },
        {
          code: 'ct02-to-khai-viet-kieu',
          name: 'Tờ khai đăng ký thường trú (Mẫu CT02 — Việt kiều)',
          required: false,
          requiredWhen: { branch: 'nuoc-ngoai' },
          templateUrl: '/assets/mẫu cư trú ct02 mặt trước.svg',
          recognition: {
            // CT02 là tờ khai đăng ký thường trú dành cho công dân VN định cư nước
            // ngoài đã nhập quốc tịch Việt Nam. mustHave để distinct vs CT01.
            mustHave: ['tờ khai', 'đăng ký thường trú'],
            shouldHave: [
              'ct02',
              'việt nam định cư ở nước ngoài',
              'hộ chiếu',
              'nhập cảnh',
              'cộng hòa xã hội',
              'độc lập',
            ],
            minScore: 0.4,
          },
        },
        {
          code: 'qsdd-giay-chung-nhan-quyen-su-dung-dat',
          name: 'Giấy chứng nhận quyền sử dụng đất',
          required: false,
          requiredWhen: { branch: 'so-huu' },
          templateUrl: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          recognition: {
            mustHave: ['giấy chứng nhận', 'quyền sử dụng đất'],
            shouldHave: [
              'quyền sở hữu',
              'tài sản',
              'gắn liền',
              'thửa đất',
              'số vào sổ',
            ],
            minScore: 0.4,
          },
        },
        {
          code: 'giay-gioi-thieu-quan-doi-cong-an',
          name: 'Giấy giới thiệu của Thủ trưởng đơn vị quản lý (quân đội/công an)',
          required: false,
          requiredWhen: { branch: 'quan-doi-cong-an' },
          recognition: {
            mustHave: ['giấy giới thiệu'],
            shouldHave: ['thủ trưởng', 'quản lý', 'công an', 'quân đội', 'đơn vị'],
            minScore: 0.4,
          },
        },
      ],
    },
    'tam-tru': {
      documents: [
        {
          code: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
          name: 'Tờ khai thay đổi thông tin cư trú (Mẫu CT01)',
          required: true,
          templateUrl: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
          recognition: {
            mustHave: ['tờ khai', 'thông tin cư trú'],
            shouldHave: ['ct01', 'thay đổi', 'họ chữ đệm', 'ngày tháng năm sinh'],
            minScore: 0.4,
          },
        },
        {
          code: 'giay-to-cho-o-tam-tru',
          name: 'Giấy tờ chứng minh chỗ ở hợp pháp (sổ đỏ, hợp đồng thuê nhà...)',
          required: true,
          templateUrl: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          recognition: {
            mustHave: ['chỗ ở'],
            shouldHave: ['hợp pháp', 'hợp đồng', 'quyền sử dụng', 'thuê nhà', 'xác nhận'],
            minScore: 0.35,
          },
        },
        {
          code: 'giay-gioi-thieu-quan-doi-cong-an',
          name: 'Giấy giới thiệu của Thủ trưởng đơn vị (quân đội/công an)',
          required: false,
          requiredWhen: { branch: 'quan-doi-cong-an' },
          recognition: {
            mustHave: ['giấy giới thiệu'],
            shouldHave: ['thủ trưởng', 'quản lý', 'công an', 'quân đội', 'đơn vị'],
            minScore: 0.4,
          },
        },
      ],
    },
    'luu-tru': {
      documents: [
        {
          code: 'mau-thong-bao-luu-tru',
          name: 'Mẫu thông báo lưu trú',
          required: true,
          templateUrl: '/assets/mau-luu-tru.svg',
          recognition: {
            mustHave: ['thông báo lưu trú'],
            shouldHave: ['họ và tên', 'địa chỉ', 'thời gian', 'công an', 'ngày đến', 'ngày đi'],
            minScore: 0.35,
          },
        },
      ],
    },
    'gia-han-tam-tru': {
      documents: [
        {
          code: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
          name: 'Tờ khai thay đổi thông tin cư trú (Mẫu CT01)',
          required: true,
          templateUrl: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
          recognition: {
            mustHave: ['tờ khai', 'thông tin cư trú'],
            shouldHave: ['ct01', 'thay đổi', 'họ chữ đệm', 'ngày tháng năm sinh'],
            minScore: 0.4,
          },
        },
        {
          code: 'don-de-nghi-gia-han-tam-tru',
          name: 'Văn bản đề nghị gia hạn tạm trú',
          required: true,
          recognition: {
            mustHave: ['gia hạn', 'tạm trú'],
            shouldHave: ['đề nghị', 'thời hạn', 'họ và tên', 'công an'],
            minScore: 0.4,
          },
        },
      ],
    },
    'xoa-dang-ky': {
      documents: [
        {
          code: 'ct01-to-khai-thay-doi-thong-tin-cu-tru',
          name: 'Tờ khai thay đổi thông tin cư trú (Mẫu CT01)',
          required: true,
          templateUrl: '/assets/mẫu test tờ khai cư trú mặt trước.svg',
          recognition: {
            mustHave: ['tờ khai', 'thông tin cư trú'],
            shouldHave: ['ct01', 'thay đổi', 'họ chữ đệm', 'ngày tháng năm sinh'],
            minScore: 0.4,
          },
        },
        {
          code: 'giay-to-minh-chung-xoa',
          name: 'Giấy tờ, tài liệu chứng minh chỗ ở hợp pháp mới hoặc không còn chỗ ở',
          required: true,
          templateUrl: '/assets/giấy chứng nhận quyền sử dụng đất.svg',
          recognition: {
            mustHave: ['chỗ ở'],
            shouldHave: ['xác nhận', 'không còn', 'chứng minh', 'hợp pháp', 'ubnd'],
            minScore: 0.35,
          },
        },
      ],
    },
  };

  const formVersionSeed = allProcedures.map((p) => ({
    procedureId: p.id,
    version: 1,
    formSchema: {
      fields: [],
      sections: [],
    },
    requiredDocs: REQUIRED_DOCS_BY_CODE[p.code] ?? { documents: [] },
    templateEngine: 'docx_merge',
  }));
  // Dùng DoUpdate để re-seed cập nhật required_docs khi thay đổi config
  const insertedVersions = [];
  for (const v of formVersionSeed) {
    const [row] = await db
      .insert(procedureFormVersions)
      .values(v)
      .onConflictDoUpdate({
        target: [
          procedureFormVersions.procedureId,
          procedureFormVersions.version,
        ],
        set: {
          formSchema: v.formSchema,
          requiredDocs: v.requiredDocs,
          templateEngine: v.templateEngine,
        },
      })
      .returning();
    if (row) insertedVersions.push(row);
  }
  console.log(
    `  ✓ procedure_form_versions: ${insertedVersions.length} upserted / ${formVersionSeed.length} total`,
  );
  // Unused map reference — remove warning when future code uses it
  void procedureByCode;

  console.log('✅ Seed complete');
}

// CLI entry — chỉ chạy khi gọi trực tiếp `npm run db:seed`, không khi import.
// Khi import từ server.ts thì caller tự quản lý sql connection.
const isCliEntry = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;
if (isCliEntry) {
  seed()
    .catch((err) => {
      console.error('❌ Seed failed:', err);
      process.exit(1);
    })
    .finally(async () => {
      await sql.end();
    });
}
