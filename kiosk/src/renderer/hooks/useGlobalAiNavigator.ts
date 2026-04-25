/**
 * useGlobalAiNavigator — điều hướng toàn cục khi không có page-specific override.
 *
 * Mounted từ Layout.tsx → luôn hoạt động.
 * Khi page hook (useAiNavigator / useFormAiOrchestrator) mount → override tạm thời.
 * Khi page hook unmount → setTranscriptOverride(null) → tự động restore về global này.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAi } from '@renderer/providers/AiProvider';
import { useConversationStore } from '@store/conversationStore';

// ── Kịch bản từng màn — LLM dùng để hiểu ngữ cảnh và hướng dẫn ─────────────
const ROUTE_SCENARIO: Record<string, string> = {
  // ── Đăng nhập ──────────────────────────────────────────────────────────────
  '/': `Màn hình đăng nhập kiosk hành chính công.
Người dùng cần quét CCCD gắn chip NFC lên đầu đọc, hoặc đăng nhập bằng VNeID trên điện thoại.
Sau khi xác thực danh tính thành công sẽ vào trang chọn dịch vụ.`,

  '/scan-guide': `Màn hướng dẫn quét CCCD gắn chip.
Người dùng cần đặt thẻ CCCD lên đầu đọc NFC và giữ yên cho đến khi nghe tiếng bíp xác nhận.
Hệ thống đang đọc dữ liệu từ chip — không rút thẻ ra giữa chừng.`,

  '/cccd-input': `Màn nhập số CCCD thủ công (thay thế khi NFC không đọc được).
Người dùng nhập 12 số trên CCCD bằng bàn phím cảm ứng, sau đó bấm Xác nhận.`,

  '/cccd-verify': `Màn xác thực khuôn mặt để đăng nhập bằng CCCD.
Hệ thống đang so sánh khuôn mặt hiện tại với ảnh trên chip CCCD.
Người dùng nhìn thẳng vào camera, đảm bảo đủ ánh sáng.`,

  '/vneid-login': `Màn đăng nhập bằng VNeID.
Người dùng mở ứng dụng VNeID trên điện thoại và quét mã QR hiển thị trên màn hình.
Hoặc nhập mã xác thực 6 số gửi đến số điện thoại đã đăng ký VNeID.`,

  // ── Chọn dịch vụ ───────────────────────────────────────────────────────────
  '/services': `Màn chọn nhóm dịch vụ hành chính công.
Các nhóm: Cư trú, Hộ tịch, Lao động - Việc làm, Giáo dục - Đào tạo, và các dịch vụ khác.
Để làm thủ tục tạm trú, thường trú, tạm vắng, lưu trú → chọn nhóm "Cư trú".`,

  '/cu-tru': `Màn chọn dịch vụ Cư trú.
Các thủ tục: [1] Đăng ký tạm trú, [2] Gia hạn tạm trú, [3] Xóa đăng ký tạm trú,
[4] Đăng ký thường trú, [5] Khai báo tạm vắng, [6] Thông báo lưu trú.
Người dùng chạm vào thẻ tương ứng để bắt đầu thủ tục.`,

  // ── Tạm trú ────────────────────────────────────────────────────────────────
  '/tam-tru-thu-tuc': `Màn chọn loại thủ tục tạm trú.
Ba lựa chọn: [1] Đăng ký tạm trú — lần đầu hoặc đổi địa chỉ mới,
[2] Gia hạn tạm trú — đăng ký cũ sắp hoặc đã hết hạn,
[3] Xóa đăng ký tạm trú — không còn ở địa chỉ đó nữa.
AI đang hỗ trợ chọn đúng thủ tục.`,

  '/tam-tru-truong-hop': `Màn chọn trường hợp tạm trú.
Các trường hợp phân theo quan hệ với chủ nhà/chủ sở hữu:
thuê/mượn nhà, theo danh sách nhân khẩu, ở nhờ người thân, theo hợp đồng lao động, v.v.
AI đang hỗ trợ xác định trường hợp phù hợp.`,

  '/tam-tru-doi-tuong': `Màn chọn đối tượng đăng ký tạm trú.
Các đối tượng: cá nhân (1 người), hoặc theo nhân khẩu hộ (nhiều người cùng hộ).
Chọn đúng đối tượng để hệ thống tạo đúng mẫu hồ sơ.`,

  '/tao-ho-so-tam-tru-danh-sach': `Màn điền thông tin hồ sơ tạm trú theo danh sách.
Người dùng đang nhập danh sách các thành viên đăng ký tạm trú cùng.
AI hỗ trợ điền thông tin từng người bằng giọng nói.`,

  '/tao-ho-so-tam-tru-nhan-khau-ho': `Màn điền hồ sơ tạm trú theo nhân khẩu hộ.
Các thông tin cần điền: số điện thoại người đăng ký, email, họ tên chủ hộ, CCCD chủ hộ,
quan hệ với chủ hộ, thời hạn tạm trú.
AI đang hỏi từng trường và điền tự động từ giọng nói.`,

  // ── Gia hạn tạm trú ────────────────────────────────────────────────────────
  '/gia-han-truong-hop': `Màn chọn trường hợp gia hạn tạm trú.
Người dùng cần chọn trường hợp phù hợp để hệ thống xác định hồ sơ cần bổ sung.
Các trường hợp tương tự đăng ký mới nhưng yêu cầu có đăng ký tạm trú cũ còn hiệu lực.`,

  '/tao-ho-so-gia-han': `Màn điền hồ sơ gia hạn tạm trú cá nhân.
Người dùng cần xác nhận thông tin địa chỉ tạm trú hiện tại và thời hạn gia hạn mong muốn.`,

  '/tao-ho-so-gia-han-danh-sach': `Màn điền hồ sơ gia hạn tạm trú theo danh sách (nhiều người).
Người dùng đang cập nhật thông tin danh sách thành viên gia hạn.`,

  // ── Xóa đăng ký tạm trú ────────────────────────────────────────────────────
  '/xoa-dang-ky-truong-hop': `Màn chọn trường hợp xóa đăng ký tạm trú.
Các trường hợp: tự nguyện xóa (chuyển đi nơi khác), hết hạn hợp đồng thuê nhà,
chủ nhà yêu cầu, hoặc di chuyển theo hộ khẩu.`,

  '/tao-ho-so-xoa-dang-ky': `Màn điền hồ sơ xóa đăng ký tạm trú.
Người dùng cần cung cấp lý do xóa và xác nhận địa chỉ tạm trú muốn xóa.`,

  // ── Thường trú ─────────────────────────────────────────────────────────────
  '/ho-khau-truong-hop': `Màn chọn trường hợp đăng ký thường trú.
Các trường hợp: chuyển về cùng vợ/chồng, chuyển về nhà sở hữu, chuyển theo cha mẹ,
thuê/mượn nhà đủ điều kiện, v.v.
Người dùng chọn trường hợp đúng với tình huống của mình.`,

  '/ho-khau-sinh-song': `Màn chọn nguồn gốc hộ khẩu (đăng ký thường trú).
Người dùng cần cho biết đang từ tỉnh/thành nào chuyển đến để hệ thống xác định thủ tục phù hợp.`,

  '/tao-ho-so-thuong-tru': `Màn điền hồ sơ đăng ký thường trú.
Thông tin cần điền: địa chỉ thường trú mới, thông tin chủ hộ, quan hệ với chủ hộ,
và các giấy tờ chứng minh quyền cư trú.
AI hỗ trợ điền thông tin qua giọng nói.`,

  // ── Tạm vắng ───────────────────────────────────────────────────────────────
  '/xac-dinh-doi-tuong': `Màn xác định đối tượng khai báo tạm vắng.
Người dùng cần xác định mình thuộc đối tượng nào: cá nhân tạm vắng,
hoặc khai báo cho thành viên trong hộ gia đình.`,

  '/tao-khai-bao-tam-vang': `Màn khai báo tạm vắng.
Người dùng đang điền thông tin: nơi đến tạm vắng, thời gian dự kiến, lý do tạm vắng.
Khai báo tạm vắng bắt buộc khi vắng mặt tại nơi thường trú quá 30 ngày.`,

  // ── Lưu trú ────────────────────────────────────────────────────────────────
  '/tao-thong-bao-luu-tru': `Màn thông báo lưu trú (dành cho cơ sở lưu trú: khách sạn, nhà trọ).
Người dùng (chủ cơ sở) đang khai báo thông tin người lưu trú mới.
Thông báo lưu trú phải thực hiện trong vòng 12 giờ kể từ khi khách đến.`,

  // ── Quét tài liệu ──────────────────────────────────────────────────────────
  '/scan-tai-lieu': `Màn quét tài liệu/giấy tờ.
Người dùng đặt giấy tờ lên máy scan, hệ thống tự động nhận dạng và OCR.
Các giấy tờ thường cần: hợp đồng thuê nhà, sổ hộ khẩu, CCCD chủ hộ, giấy tờ nhà đất.`,

  '/scan-tam-tru':           `Màn quét giấy tờ cho thủ tục tạm trú. Đặt hợp đồng thuê nhà hoặc giấy tờ nhà lên scanner.`,
  '/scan-tam-tru-ct01':      `Màn quét giấy tờ tạm trú trường hợp CT01. Đặt tài liệu phù hợp lên scanner.`,
  '/scan-tam-tru-quan-doi':  `Màn quét giấy tờ tạm trú cho quân đội/công an. Đặt giấy giới thiệu đơn vị lên scanner.`,
  '/scan-tam-tru-phuong-tien': `Màn quét giấy tờ tạm trú trên phương tiện. Đặt đăng ký phương tiện lên scanner.`,
  '/scan-tam-tru-thue-muon': `Màn quét hợp đồng thuê/mượn nhà cho tạm trú. Đặt hợp đồng lên scanner.`,
  '/scan-tam-vang':          `Màn quét giấy tờ cho khai báo tạm vắng. Đặt giấy tờ liên quan lên scanner.`,
  '/scan-luu-tru':           `Màn quét giấy tờ thông báo lưu trú. Đặt CCCD/hộ chiếu của người lưu trú lên scanner.`,
  '/scan-ho-khau':           `Màn quét giấy tờ đăng ký thường trú. Đặt sổ hộ khẩu, giấy tờ nhà lên scanner.`,
  '/scan-gia-han':           `Màn quét giấy tờ gia hạn tạm trú. Đặt hợp đồng thuê nhà mới hoặc gia hạn lên scanner.`,
  '/scan-gia-han-danh-sach': `Màn quét giấy tờ gia hạn tạm trú theo danh sách. Đặt hợp đồng lên scanner.`,
  '/scan-xoa-dang-ky':       `Màn quét giấy tờ xóa đăng ký tạm trú. Đặt giấy tờ liên quan lên scanner.`,

  // ── Xem trước hồ sơ ────────────────────────────────────────────────────────
  '/xem-truoc-ho-so':            `Màn xem trước hồ sơ trước khi nộp. Người dùng kiểm tra lại toàn bộ thông tin. Nếu cần sửa → bấm Quay lại. Nếu đúng → bấm Nộp hồ sơ.`,
  '/xem-truoc-tam-tru':          `Màn xem trước hồ sơ đăng ký tạm trú. Kiểm tra thông tin trước khi nộp chính thức.`,
  '/xem-truoc-tam-tru-ct01':     `Màn xem trước hồ sơ tạm trú CT01. Kiểm tra thông tin trước khi nộp.`,
  '/xem-truoc-tam-tru-quan-doi': `Màn xem trước hồ sơ tạm trú quân đội/công an. Kiểm tra trước khi nộp.`,
  '/xem-truoc-tam-tru-phuong-tien': `Màn xem trước hồ sơ tạm trú phương tiện. Kiểm tra trước khi nộp.`,
  '/xem-truoc-tam-tru-thue-muon': `Màn xem trước hồ sơ tạm trú thuê/mượn. Kiểm tra trước khi nộp.`,
  '/xem-truoc-tam-vang':         `Màn xem trước khai báo tạm vắng. Kiểm tra thông tin trước khi nộp.`,
  '/xem-truoc-luu-tru':          `Màn xem trước thông báo lưu trú. Kiểm tra trước khi nộp.`,
  '/xem-truoc-ho-khau':          `Màn xem trước hồ sơ thường trú. Kiểm tra toàn bộ thông tin trước khi nộp.`,
  '/xem-truoc-gia-han':          `Màn xem trước hồ sơ gia hạn tạm trú. Kiểm tra trước khi nộp.`,
  '/xem-truoc-gia-han-danh-sach': `Màn xem trước danh sách gia hạn tạm trú. Kiểm tra trước khi nộp.`,
  '/xem-truoc-xoa-dang-ky':      `Màn xem trước hồ sơ xóa đăng ký tạm trú. Kiểm tra trước khi nộp.`,

  // ── Kết thúc & Hồ sơ ──────────────────────────────────────────────────────
  '/ho-so-cua-toi': `Màn xem danh sách hồ sơ đã nộp.
Người dùng xem trạng thái xử lý các hồ sơ: đang xử lý, đã duyệt, cần bổ sung.
Có thể tiếp tục hồ sơ nháp chưa nộp hoặc xem chi tiết từng hồ sơ.`,

  '/nop-ho-so-thanh-cong': `Màn xác nhận nộp hồ sơ thành công.
Hệ thống đã ghi nhận hồ sơ và sẽ xử lý trong vòng 3-5 ngày làm việc.
Người dùng có thể về trang dịch vụ để thực hiện thủ tục khác hoặc xem hồ sơ của mình.`,
};

// Các route trước khi đăng nhập — AI chỉ được nói về login flow
const PRE_LOGIN_ROUTES = new Set(['/', '/scan-guide', '/cccd-input', '/cccd-verify', '/vneid-login']);

// Điều hướng cho phép khi chưa đăng nhập
const NAVIGABLE_PRE_LOGIN = [
  { route: '/scan-guide', desc: 'Hướng dẫn quét CCCD để đăng nhập' },
  { route: '/vneid-login', desc: 'Đăng nhập bằng VNeID' },
];

// Điều hướng đầy đủ sau khi đã đăng nhập
const NAVIGABLE_POST_LOGIN = [
  { route: '/services',               desc: 'Menu dịch vụ / trang chủ' },
  { route: '/cu-tru',                 desc: 'Nhóm dịch vụ Cư trú (tạm trú, thường trú, tạm vắng, lưu trú)' },
  { route: '/tam-tru-thu-tuc',        desc: 'Thủ tục tạm trú: đăng ký mới / gia hạn / xóa' },
  { route: '/gia-han-truong-hop',     desc: 'Gia hạn tạm trú' },
  { route: '/xoa-dang-ky-truong-hop', desc: 'Xóa đăng ký tạm trú' },
  { route: '/ho-khau-truong-hop',     desc: 'Đăng ký thường trú' },
  { route: '/xac-dinh-doi-tuong',     desc: 'Khai báo tạm vắng' },
  { route: '/ho-so-cua-toi',          desc: 'Xem hồ sơ của tôi / hồ sơ đã nộp' },
  { route: '/',                       desc: 'Đăng xuất / thoát phiên làm việc' },
];

const NAV_SCHEMA = {
  type: 'OBJECT',
  properties: {
    action: {
      type: 'STRING',
      description: 'Giá trị "navigate" nếu muốn chuyển trang, "answer" nếu chỉ trả lời',
    },
    route: {
      type: 'STRING',
      description: 'Đường dẫn trang cần đến, ví dụ /services (chỉ khi action là navigate)',
    },
    text: {
      type: 'STRING',
      description: 'Câu trả lời ngắn 1-2 câu bằng tiếng Việt để đọc cho người dùng nghe',
    },
  },
  required: ['action', 'text'],
};

// ── Câu giới thiệu tự động khi AI navigate đến trang mới ────────────────────
const PAGE_GREETING: Record<string, string> = {
  '/services':
    'Đây là trang dịch vụ công. Bạn có thể chọn nhóm dịch vụ phù hợp như Cư trú, Hộ tịch, Lao động, Giáo dục và nhiều lĩnh vực khác.',

  '/cu-tru':
    'Nhóm dịch vụ Cư trú gồm: Đăng ký tạm trú, Gia hạn tạm trú, Xóa đăng ký tạm trú, Đăng ký thường trú, Khai báo tạm vắng và Thông báo lưu trú. Bạn cần thủ tục nào?',

  '/tam-tru-thu-tuc':
    'Có 3 thủ tục tạm trú: Đăng ký tạm trú mới, Gia hạn tạm trú khi sắp hết hạn, và Xóa đăng ký tạm trú khi chuyển đi. Bạn muốn thực hiện thủ tục nào?',

  '/gia-han-truong-hop':
    'Gia hạn tạm trú — vui lòng chọn trường hợp phù hợp với tình huống của bạn để hệ thống xác định hồ sơ cần chuẩn bị.',

  '/xoa-dang-ky-truong-hop':
    'Xóa đăng ký tạm trú — vui lòng chọn lý do xóa để hệ thống tạo đúng biểu mẫu cho bạn.',

  '/ho-khau-truong-hop':
    'Đăng ký thường trú — có nhiều trường hợp khác nhau tùy theo quan hệ với chủ hộ và quyền sở hữu nhà. Vui lòng chọn trường hợp phù hợp.',

  '/xac-dinh-doi-tuong':
    'Khai báo tạm vắng — vui lòng xác định bạn đang khai báo cho cá nhân hay theo hộ gia đình.',

  '/ho-so-cua-toi':
    'Đây là danh sách hồ sơ của bạn. Bạn có thể xem trạng thái các hồ sơ đã nộp hoặc tiếp tục hồ sơ còn nháp.',
};

// ── Restriction theo từng màn pre-login ──────────────────────────────────────
function buildPreLoginRestriction(route: string): string {
  const base =
    `QUAN TRỌNG: Người dùng CHƯA đăng nhập. ` +
    `KHÔNG giải thích chi tiết dịch vụ, thủ tục hay quy trình hồ sơ. ` +
    `Nếu user hỏi về dịch vụ → trả lời "Vui lòng đăng nhập trước để sử dụng dịch vụ."`;

  switch (route) {
    case '/vneid-login':
      return (
        base +
        ` Chỉ hướng dẫn đăng nhập bằng VNeID: mở app VNeID trên điện thoại, quét QR hoặc nhập mã 6 số. ` +
        `KHÔNG đề cập CCCD hay phương thức đăng nhập khác.`
      );
    case '/scan-guide':
    case '/cccd-input':
    case '/cccd-verify':
      return (
        base +
        ` Chỉ hướng dẫn quét CCCD gắn chip NFC: đặt thẻ lên đầu đọc, giữ yên, chờ xác nhận. ` +
        `KHÔNG đề cập VNeID hay phương thức đăng nhập khác.`
      );
    default: // '/'
      return (
        base +
        ` Chỉ hướng dẫn 2 cách đăng nhập: [1] Quét CCCD gắn chip NFC, [2] Đăng nhập VNeID. ` +
        `Không đi sâu vào chi tiết từng cách — user chọn cách nào thì hướng dẫn cách đó.`
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function useGlobalAiNavigator() {
  const navigate = useNavigate();
  const { setDefaultTranscriptOverride } = useAi();
  const currentRouteRef = useRef('/');

  const currentRoute = useConversationStore((s) => s.currentRoute);
  useEffect(() => { currentRouteRef.current = currentRoute; }, [currentRoute]);

  const handler = useCallback(async (transcript: string): Promise<string> => {
    const route = currentRouteRef.current;
    // Dùng route để xác định: nếu đang ở PRE_LOGIN_ROUTES → chưa login
    // Không dùng store vì UI có thể dùng MOCK_USER fallback (store.user = null)
    const isPreLogin = PRE_LOGIN_ROUTES.has(route);

    const scenario = ROUTE_SCENARIO[route] ?? `Người dùng đang ở trang: ${route}.`;
    const navigable = isPreLogin ? NAVIGABLE_PRE_LOGIN : NAVIGABLE_POST_LOGIN;
    const routeList = navigable.map((r) => `- ${r.route}: ${r.desc}`).join('\n');

    const restriction = isPreLogin
      ? buildPreLoginRestriction(route)
      : `Người dùng đã đăng nhập. Hỗ trợ đầy đủ các thủ tục hành chính.`;

    const systemPrompt =
      `Bạn là trợ lý AI kiosk hành chính công tên KioskAI.\n` +
      `${scenario}\n` +
      `${restriction}\n\n` +
      `Phân tích câu nói:\n` +
      `- Muốn đến trang khác → action: "navigate", route phù hợp từ danh sách:\n${routeList}\n` +
      `- Hỏi thông tin → action: "answer"\n` +
      `Trả lời ngắn (1-2 câu), tiếng Việt, lịch sự.`;

    // Thử JSON mode trước — nếu bất kỳ lỗi nào xảy ra, fallback về plain text
    try {
      const raw = (await window.electronAPI.invoke('llm:chat', {
        text: transcript,
        systemPrompt,
        responseSchema: NAV_SCHEMA,
      })) as string;

      try {
        const parsed = JSON.parse(raw) as { action?: string; route?: string; text?: string };
        if (parsed.action === 'navigate' && parsed.route) {
          const valid = navigable.find((r) => r.route === parsed.route);
          if (valid) {
            setTimeout(() => navigate(parsed.route!), 800);
            // Ghép greeting của trang đích vào câu trả lời
            const greeting = PAGE_GREETING[parsed.route] ?? '';
            const fullText = [parsed.text?.trim(), greeting].filter(Boolean).join(' ');
            if (fullText) return fullText;
          }
        }
        if (parsed.text?.trim()) return parsed.text;
      } catch {
        // JSON parse fail — raw text trực tiếp nếu không phải JSON
        if (raw?.trim() && !raw.startsWith('{')) return raw;
      }
    } catch { /* JSON mode không khả dụng — fallback bên dưới */ }

    // Fallback: plain llm:chat không schema
    try {
      const fallbackPrompt = isPreLogin
        ? `Trợ lý kiosk. ${buildPreLoginRestriction(route)} Trả lời ngắn tiếng Việt.`
        : `Trợ lý kiosk hành chính. ${scenario} Trả lời ngắn 1-2 câu tiếng Việt.`;
      return (await window.electronAPI.invoke('llm:chat', {
        text: transcript,
        systemPrompt: fallbackPrompt,
      })) as string;
    } catch {
      return 'Xin lỗi, hệ thống đang gặp sự cố. Vui lòng thử lại.';
    }
  }, [navigate]);

  useEffect(() => {
    setDefaultTranscriptOverride(handler);
  }, [handler, setDefaultTranscriptOverride]);
}
