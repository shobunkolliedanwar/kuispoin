import {describe,expect,it} from 'vitest';
import {parseWithdrawalInput} from '../../lib/withdrawal-input';

describe('withdrawal payload',()=>{
  it('normalizes a valid payload',()=>expect(parseWithdrawalInput({points:1000,method:'dana',accountNumber:'0812-3456 7890',accountName:' Shobun '})).toEqual({points:1000,method:'DANA',account:'081234567890',name:'Shobun'}));
  it.each([null,{}, {points:0,method:'DANA',accountNumber:'081234567890'}, {points:1.5,method:'DANA',accountNumber:'081234567890'}, {points:1000,method:'BANK',accountNumber:'081234567890'}, {points:1000,method:'DANA',accountNumber:'abc'}])('rejects invalid payload %#',payload=>expect(parseWithdrawalInput(payload)).toBeNull());
  it('rejects overlong account name',()=>expect(parseWithdrawalInput({points:1000,method:'DANA',accountNumber:'081234567890',accountName:'x'.repeat(101)})).toBeNull());
});
