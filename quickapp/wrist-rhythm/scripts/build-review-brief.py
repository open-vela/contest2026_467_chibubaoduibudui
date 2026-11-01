"""Generate a concise review brief; no historical screenshots or invented device results."""
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/review-readiness-20261011"


def build():
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Inches(8.5), Inches(11)
    sec.top_margin = sec.bottom_margin = Inches(0.75)
    sec.left_margin = sec.right_margin = Inches(0.8)
    for name in ["Normal", "Title", "Heading 1", "Heading 2"]:
        style = doc.styles[name]
        style.font.name = "Microsoft YaHei"
        style._element.get_or_add_rPr().get_or_add_rFonts().set(qn("w:eastAsia"), "Microsoft YaHei")
        style.font.color.rgb = RGBColor(0, 0, 0)
    normal = doc.styles["Normal"]
    normal.font.size = Pt(11)
    normal.paragraph_format.line_spacing = 1.2
    normal.paragraph_format.space_after = Pt(7)
    doc.styles["Title"].font.size = Pt(23)
    doc.styles["Heading 1"].font.size = Pt(16)
    doc.styles["Heading 2"].font.size = Pt(12)
    for border in list(doc.styles.element.iter(qn("w:pBdr"))):
        border.getparent().remove(border)
    footer = sec.footer.paragraphs[0]
    footer.alignment = 2
    footer.add_run("腕上节律  评审准备版本  |  ")
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)

    def p(text):
        doc.add_paragraph(text)

    def h(text):
        doc.add_heading(text, level=2)

    doc.add_paragraph("腕上节律评审说明", style="Title")
    p("2026 年 10 月 11 日  ·  codex/review-readiness")
    p("腕上节律面向 openvela 手表，以一分钟呼吸训练为主要体验，并提供三十秒腕部动作节拍挑战。本次版本优先补齐数据可信度、节奏解释和失败降级，帮助评委评估已实现能力及其验证边界。")
    h("用户场景")
    p("用户在学习或工作间隙抬腕开始短时训练。健康数据可用时用于提示和节奏选择；不可用时仍能完成呼吸引导。主流程无需账号和云服务。")
    h("稳态训练")
    p("提供 4-2-4 标准节奏和 4-2-6 舒缓节奏。系统仅在完整呼吸周期边界调整下一周期，并显示选择原因。无有效数据时明确采用默认节奏。倒计时累计前台有效时间，后台暂停后可恢复。")
    h("可信的数据状态")
    p("心率、压力独立判断有效性；重复或乱序样本不增加趋势窗口。首页区分读取中、部分可用、过期和接口不支持，不将样本不足表述为状态平稳。")
    p("结果比较要求有效基线以及训练开始后产生的有效新样本。没有新样本时显示无法比较，不用零差值代替缺失数据。完成训练不依赖健康数值下降。")
    h("节奏拳")
    p("通过相邻三轴加速度变化检测腕部动作，使用 350ms 防抖，再根据动作与节拍的时间差计分。算法不识别拳种，日常甩手可能触发；准确性需真人标注测试。无传感器数据时不提供点击模拟得分，可直接结束并返回首页。")

    doc.add_page_break()
    doc.add_heading("工程验证与证据边界", level=1)
    p("本次本地回归与 Debug、Release 构建已运行，最终结果以交付目录 tests.log、build.log、release.log 和 evidence.json 为准。构建成功不等于真机安装、现场可用或正式分发授权。")
    h("自动化验证内容")
    p("覆盖健康数据过滤、独立指标提示、时间戳去重、过期、结果比较、页面前后台恢复、资源释放、组件绑定和构建输入隔离。页面方法在 Node.js 下执行，不等于完整设备 UI 渲染。")
    h("构建隔离")
    p("两种构建均复制最小必要输入到 ASCII 临时目录，排除历史视频、文档、备份及其他工作树。只发布对应模式的非空新 RPK，并保留原版本备份。")
    h("仍需校准的输入假设")
    p("原型新鲜度上限为心率 60 秒、压力 300 秒，不能视为厂商更新周期。日期时间戳按 Unix 秒或毫秒解释；不支持设备开机相对时间。心率要求大于零，压力接受 0 至 100。目标设备的量程、时间戳格式和采样周期尚待确认。")
    p("旧官方健康文档地址在本次访问中返回概述，已安装类型文件未包含项目所用的新接口。因此本报告不将上述策略称为已核实的官方规范。")
    h("不能由当前证据推出的结论")
    p("未进行真人动作识别评测、功耗与续航测量、帧率与内存基准或健康效果研究。模拟器输入只能验证业务处理，不能作为真实生理变化或人体动作准确率证据。模拟器验收情况请以单独记录为准。")
    h("AI 与产品创新的表述")
    p("运行时使用端侧规则和差分检测，未集成机器学习模型。AI 辅助开发与运行时 AI 是不同概念。创新集中在短时训练流程、数据驱动节奏和能力降级的组合；尚无用户研究证明优于原生应用。")

    doc.add_page_break()
    doc.add_heading("现场演示与人工验收", level=1)
    h("三分钟演示顺序")
    for text in [
        "1. 首页说明用户场景与实际数据来源。没有数据时展示真实降级，不承诺数字必然出现。",
        "2. 完整运行一次 60 秒呼吸，说明阶段变化、节奏选择原因和周期边界调整。",
        "3. 解释结果有效性：有本次新样本才比较，无法比较不影响完成训练。",
        "4. 展示节奏拳；模拟器注入必须称为模拟输入。演示动作不可用时如何返回首页。",
        "5. 说明尚未完成的设备与真人验证。备用录像须标明版本和数据来源，剪辑时标注节选。",
    ]:
        p(text)
    h("现场记录 由实际执行者填写")
    p("执行者与日期：________________    设备或模拟器：________________")
    p("系统版本及 RPK SHA-256：____________________________________")
    for text in [
        "安装与冷启动：待执行    完整呼吸与结果：待执行",
        "圆屏文字及按钮无裁切：待执行    前后台恢复：待执行",
        "健康或动作能力不可用：待执行    断网运行：待执行",
        "连续三次现场彩排：待执行    备用录像离线播放：待执行",
    ]:
        p(text)
    h("动作观察与后续工作")
    p("邀请 3 至 5 名体验者，以匿名编号记录佩戴条件。分别观察明确动作、自然摆臂、抬腕调整和静止，保留检出、重复触发、误触发及节拍得分。不能把节拍未得分直接算作漏检。目前没有真人数据，不提供准确率。")
    p("评审后依次验证可关闭的震动提示、动作数据与独立评测、本地训练记录。完整步骤和空白观察表见 docs/review-readiness.md。")
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "腕上节律评审说明.docx"
    doc.save(target)
    print(target)


if __name__ == "__main__":
    build()
