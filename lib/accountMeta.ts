import { AccountType, AccountCategory } from './types';

export interface AccountMeta {
  category: AccountCategory;
  label: string;
  color: string;
  annualLimitKrw?: number;  // 만원 단위
  withdrawalAge?: number;
  taxBenefit?: string;
  restrictions: string[];
  tips: string[];
}

export const ACCOUNT_META: Record<AccountType, AccountMeta> = {
  IRP: {
    category: '절세',
    label: '개인형퇴직연금 (IRP)',
    color: '#f59e0b',
    annualLimitKrw: 1800,
    withdrawalAge: 55,
    taxBenefit: '세액공제 최대 148.5만원 (연 900만원 한도, IRP+연금저축 합산)',
    restrictions: ['중도인출 불가 (원칙)', '55세 이후 연금수령', '연간 납입한도 1,800만원'],
    tips: ['퇴직금 이전 시 한도 별도 적용', '55세 미만 해지 시 기타소득세 16.5%', '연금수령 시 연금소득세 3.3~5.5%'],
  },
  연금저축: {
    category: '절세',
    label: '연금저축펀드',
    color: '#10b981',
    annualLimitKrw: 1800,
    withdrawalAge: 55,
    taxBenefit: 'IRP 합산 세액공제 (연 600만원 한도)',
    restrictions: ['55세 이후 연금수령', '중도해지 시 기타소득세 16.5%'],
    tips: ['주식형 ETF 직접 투자 가능', 'ISA 만기금액 이전 시 추가 10% 세액공제', 'IRP보다 투자 자유도 높음'],
  },
  ISA: {
    category: '절세',
    label: '개인종합자산관리계좌 (ISA)',
    color: '#6366f1',
    annualLimitKrw: 2000,
    taxBenefit: '비과세 200만원 (서민형·농어민 400만원), 초과분 9.9% 분리과세',
    restrictions: ['3년 의무유지 후 만기/해지 가능', '연간 납입한도 2,000만원 (5년 누적 1억)'],
    tips: ['만기 시 연금계좌 이전하면 이전금액의 10% 추가 세액공제', '국내 상장 ETF 수익은 비과세 적용', '손익통산 가능'],
  },
  퇴직연금DC: {
    category: '퇴직',
    label: '퇴직연금 DC형',
    color: '#3b82f6',
    withdrawalAge: 55,
    restrictions: ['원칙적 중도인출 불가', '55세 이후 연금수령 또는 일시금', '무주택자 주택구입 등 예외 인출 가능'],
    tips: ['본인 추가납입 가능 (IRP 통산)', '디폴트옵션 확인 필수', '연간 운용수익 과세이연'],
  },
  퇴직연금DB: {
    category: '퇴직',
    label: '퇴직연금 DB형',
    color: '#8b5cf6',
    withdrawalAge: 55,
    restrictions: ['회사가 운용', '퇴직 전 인출 불가', '퇴직 시 확정금액 지급'],
    tips: ['최종 3개월 평균급여 × 근속년수로 계산', '회사 파산 시 우선변제권 보호', '임금 상승률 높으면 DB가 유리'],
  },
  일반: {
    category: '일반',
    label: '일반주식계좌',
    color: '#6b7280',
    restrictions: [],
    tips: ['해외주식 양도차익: 연 250만원 공제 후 22%', '국내주식 대주주(50억↑) 아니면 비과세', 'ISA/연금계좌로 전환 고려'],
  },
  CMA: {
    category: '일반',
    label: 'CMA',
    color: '#6b7280',
    restrictions: [],
    tips: ['수시입출금 가능', 'RP형/MMF형/MMW형 구분', '예금자보호 미적용 (RP형은 국채 담보)'],
  },
  예금계좌: {
    category: '일반',
    label: '은행 예금',
    color: '#6b7280',
    restrictions: [],
    tips: ['예금자보호 5,000만원 (1인·1금융사)', '중도해지 시 약정금리 미적용', '복리정기예금 활용 고려'],
  },
  기타: {
    category: '일반',
    label: '기타',
    color: '#6b7280',
    restrictions: [],
    tips: [],
  },
};

export const CATEGORY_COLOR: Record<AccountCategory, string> = {
  절세: '#f59e0b',
  퇴직: '#3b82f6',
  일반: '#6b7280',
};
