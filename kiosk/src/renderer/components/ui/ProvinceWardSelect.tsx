import '@styles/pages/tao-khai-bao-tam-vang.css';
import { useEffect, useRef, useState } from 'react';
import { Provinces } from 'new-vn-provinces';
import { Dropdown, type DropdownItem } from './Dropdown';

interface ProvinceWardSelectProps {
  province?: DropdownItem | null;
  ward?: DropdownItem | null;
  onProvinceChange: (item: DropdownItem) => void;
  onWardChange: (item: DropdownItem) => void;
  /** Init lần đầu theo tên tỉnh (VD từ CCCD.thuongTru.province). */
  defaultProvinceName?: string;
  defaultWardName?: string;
  provincePlaceholder?: string;
  wardPlaceholder?: string;
  /** Gọi khi ward thay đổi — dùng để auto-fill "Công an {ward}" ở input khác. */
  onCoquan?: (coquan: string) => void;
}

interface ApiProvince {
  idProvince: string;
  name: string;
}

interface ApiWard {
  idWard: string;
  name: string;
}

/**
 * Cascade tỉnh → xã/phường (sau sáp nhập, API async).
 * Load province list lần đầu. Khi chọn province → load wards của province đó.
 */
export function ProvinceWardSelect({
  province,
  ward,
  onProvinceChange,
  onWardChange,
  defaultProvinceName,
  defaultWardName,
  provincePlaceholder = 'Chọn Tỉnh/Thành',
  wardPlaceholder = 'Chọn Xã/Phường',
  onCoquan,
}: ProvinceWardSelectProps) {
  const [provinces, setProvinces] = useState<DropdownItem[]>([]);
  const [wards, setWards] = useState<DropdownItem[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = (await Provinces.getAllProvince()) as ApiProvince[];
        if (cancelled) return;
        const items: DropdownItem[] = list.map((p) => ({ code: p.idProvince, name: p.name }));
        setProvinces(items);

        if (initializedRef.current) return;
        initializedRef.current = true;

        if (defaultProvinceName) {
          const match = items.find((p) => p.name === defaultProvinceName);
          if (match && !province) {
            onProvinceChange(match);
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          // eslint-disable-next-line no-console
          console.error('[ProvinceWardSelect] load provinces failed:', err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [defaultProvinceName, onProvinceChange, province]);

  useEffect(() => {
    let cancelled = false;
    if (!province) {
      setWards([]);
      return;
    }
    void (async () => {
      try {
        const list = (await Provinces.getWardsByProvinceId(province.code)) as ApiWard[];
        if (cancelled) return;
        const items: DropdownItem[] = list.map((w) => ({ code: w.idWard, name: w.name }));
        setWards(items);

        if (defaultWardName && !ward) {
          const match = items.find((w) => w.name === defaultWardName);
          if (match) onWardChange(match);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          // eslint-disable-next-line no-console
          console.error('[ProvinceWardSelect] load wards failed:', err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [province, defaultWardName, onWardChange, ward]);

  const handleProvinceChange = (item: DropdownItem) => {
    onProvinceChange(item);
    // Reset ward khi đổi province
    if (ward) onWardChange({ code: '', name: '' });
    onCoquan?.('');
  };

  const handleWardChange = (item: DropdownItem) => {
    onWardChange(item);
    onCoquan?.(`Công an ${item.name}`);
  };

  return (
    <>
      <Dropdown
        value={province}
        placeholder={provincePlaceholder}
        items={provinces}
        onChange={handleProvinceChange}
      />
      <Dropdown
        value={ward}
        placeholder={wardPlaceholder}
        items={wards}
        onChange={handleWardChange}
        disabled={!province}
      />
    </>
  );
}
