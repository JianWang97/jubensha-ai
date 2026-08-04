import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function TestSelectPage() {
  const [value1, setValue1] = React.useState('')
  const [value2, setValue2] = React.useState('')

  return (
    <div className="min-h-screen bg-ink text-paper p-8 space-y-8">
      <h1 className="font-dossier text-2xl font-bold text-paper">Select组件测试</h1>
      
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-mist">普通Select（无搜索功能）</h2>
        <Select value={value1} onValueChange={setValue1}>
          <SelectTrigger className="w-[200px] bg-panel border-line text-paper">
            <SelectValue placeholder="选择一个选项" />
          </SelectTrigger>
          <SelectContent className="bg-panel border-line text-paper">
            <SelectItem value="apple">苹果</SelectItem>
            <SelectItem value="banana">香蕉</SelectItem>
            <SelectItem value="orange">橙子</SelectItem>
            <SelectItem value="grape">葡萄</SelectItem>
            <SelectItem value="watermelon">西瓜</SelectItem>
            <SelectItem value="strawberry">草莓</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-mist">选中的值: {value1}</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-mist">带搜索功能的Select</h2>
        <Select 
          value={value2} 
          onValueChange={setValue2}
          searchable={true}
          searchPlaceholder="搜索水果..."
          emptyText="没有找到匹配的水果"
        >
          <SelectTrigger className="w-[200px] bg-panel border-line text-paper">
            <SelectValue placeholder="搜索并选择水果" />
          </SelectTrigger>
          <SelectContent className="bg-panel border-line text-paper">
            <SelectItem value="apple">苹果</SelectItem>
            <SelectItem value="banana">香蕉</SelectItem>
            <SelectItem value="orange">橙子</SelectItem>
            <SelectItem value="grape">葡萄</SelectItem>
            <SelectItem value="watermelon">西瓜</SelectItem>
            <SelectItem value="strawberry">草莓</SelectItem>
            <SelectItem value="pineapple">菠萝</SelectItem>
            <SelectItem value="mango">芒果</SelectItem>
            <SelectItem value="kiwi">猕猴桃</SelectItem>
            <SelectItem value="peach">桃子</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-mist">选中的值: {value2}</p>
      </div>
    </div>
  )
}